// SPDX-License-Identifier: AGPL-3.0-or-later
//! Typisierte Basisprojektionen mit unveränderter V1-Reihenfolge und Centprüfung.
use crate::{
    CoreResult, MAX_SAFE,
    aggregate_schema::INVALID,
    models::{Aggregate, GroupKind, Transaction, TransactionKind},
    scalars::{EntityId, MoneyCents},
};
use serde::Serialize;
use serde_json::Value;
use std::{cmp::Ordering, collections::BTreeMap};
pub fn uuid_order(a: &str, b: &str) -> Ordering {
    a.to_ascii_lowercase()
        .cmp(&b.to_ascii_lowercase())
        .then_with(|| b.cmp(a))
}
pub fn add(a: i64, b: i64, message: &'static str) -> CoreResult<i64> {
    let n = a as i128 + b as i128;
    if !(-(MAX_SAFE as i128)..=MAX_SAFE as i128).contains(&n) {
        Err(("MONEY_OVERFLOW", message))
    } else {
        Ok(n as i64)
    }
}
fn sum(a: MoneyCents, b: MoneyCents, message: &'static str) -> CoreResult<MoneyCents> {
    a.checked_add(b).map_err(|(code, _)| (code, message))
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountBalance {
    pub account_id: EntityId,
    pub balance: MoneyCents,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryConsumption {
    pub category_id: EntityId,
    pub group_kind: GroupKind,
    pub amount: MoneyCents,
}
#[derive(Debug, Serialize)]
pub struct Consumption {
    pub income: MoneyCents,
    pub expense: MoneyCents,
    pub net: MoneyCents,
    pub categories: Vec<CategoryConsumption>,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectionSet {
    pub account_balances: Vec<AccountBalance>,
    pub consumption: Consumption,
}
fn transactions(all: &[Aggregate]) -> Vec<&Transaction> {
    let mut values = all
        .iter()
        .filter_map(|a| match a {
            Aggregate::Transaction(tx) if a.is_live() => Some(tx),
            _ => None,
        })
        .collect::<Vec<_>>();
    values.sort_by(|a, b| uuid_order(a.id.as_str(), b.id.as_str()));
    values
}
pub fn typed_balances(all: &[Aggregate]) -> CoreResult<Vec<AccountBalance>> {
    let mut balances = BTreeMap::<&EntityId, MoneyCents>::new();
    for tx in transactions(all) {
        let old = balances
            .get(&tx.account_id)
            .copied()
            .unwrap_or(MoneyCents::new(0)?);
        balances.insert(
            &tx.account_id,
            sum(
                old,
                tx.amount,
                "Der Kontostand überschreitet den sicheren Centbereich.",
            )?,
        );
    }
    let mut values = balances
        .into_iter()
        .map(|(id, balance)| AccountBalance {
            account_id: id.clone(),
            balance,
        })
        .collect::<Vec<_>>();
    values.sort_by(|a, b| uuid_order(a.account_id.as_str(), b.account_id.as_str()));
    Ok(values)
}
pub fn typed_consumption(all: &[Aggregate]) -> CoreResult<Consumption> {
    const MISSING: (&str, &str) = (
        "INVALID_AGGREGATE",
        "Eine Verbrauchsprojektion benötigt jede referenzierte Kategorie und Kategoriegruppe.",
    );
    let by_id = all.iter().map(|a| (a.id(), a)).collect::<BTreeMap<_, _>>();
    let mut amounts = Vec::<(&EntityId, GroupKind, Vec<MoneyCents>)>::new();
    let mut category_index = BTreeMap::<&EntityId, usize>::new();
    let (mut income, mut raw_expense) = (MoneyCents::new(0)?, MoneyCents::new(0)?);
    for tx in transactions(all)
        .into_iter()
        .filter(|tx| tx.kind == TransactionKind::Normal)
    {
        for split in &tx.splits {
            let Some(Aggregate::Category(category)) = by_id.get(&split.category_id) else {
                return Err(MISSING);
            };
            let Some(Aggregate::CategoryGroup(group)) = by_id.get(&category.group_id) else {
                return Err(MISSING);
            };
            let index = *category_index.entry(&split.category_id).or_insert_with(|| {
                amounts.push((&split.category_id, group.kind, vec![]));
                amounts.len() - 1
            });
            amounts[index].2.push(split.amount);
            if group.kind == GroupKind::Income {
                income = sum(
                    income,
                    split.amount,
                    "Die Einnahmensumme überschreitet den sicheren Centbereich.",
                )?;
            } else {
                raw_expense = sum(
                    raw_expense,
                    split.amount,
                    "Die Ausgabensumme überschreitet den sicheren Centbereich.",
                )?;
            }
        }
    }
    let expense = MoneyCents::new(-raw_expense.cents())?;
    let net = sum(
        income,
        raw_expense,
        "Der Verbrauchssaldo überschreitet den sicheren Centbereich.",
    )?;
    let mut categories = vec![];
    for (id, group_kind, values) in amounts {
        let mut total = MoneyCents::new(0)?;
        for value in values {
            total = sum(
                total,
                value,
                "Die Kategoriesumme überschreitet den sicheren Centbereich.",
            )?;
        }
        categories.push(CategoryConsumption {
            category_id: id.clone(),
            group_kind,
            amount: total,
        });
    }
    categories.sort_by(|a, b| uuid_order(a.category_id.as_str(), b.category_id.as_str()));
    Ok(Consumption {
        income,
        expense,
        net,
        categories,
    })
}
fn from_wire(all: &[Value]) -> CoreResult<Vec<Aggregate>> {
    all.iter().map(Aggregate::from_wire).collect()
}
fn to_wire<T: Serialize>(value: T) -> CoreResult<Value> {
    serde_json::to_value(value).map_err(|_| INVALID)
}
// Übergangsadapter für die noch dynamischen Handler; Berechnung nur typisiert.
pub fn consumption(all: &[Value]) -> CoreResult<Value> {
    to_wire(typed_consumption(&from_wire(all)?)?)
}
pub fn balances(all: &[Value]) -> CoreResult<Vec<Value>> {
    typed_balances(&from_wire(all)?)?
        .into_iter()
        .map(to_wire)
        .collect()
}
pub fn rebuild(all: &[Value]) -> CoreResult<Value> {
    let all = from_wire(all)?;
    to_wire(ProjectionSet {
        account_balances: typed_balances(&all)?,
        consumption: typed_consumption(&all)?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    fn aggregate(index: u32, mut fields: Value) -> Aggregate {
        let object = fields.as_object_mut().unwrap();
        object.extend(
            serde_json::from_value::<serde_json::Map<String, Value>>(json!({
                "id":format!("40000000-0000-4000-8000-{index:012}"),
                "spaceId":"40000000-0000-4000-8000-000000000000", "revision":1,
                "createdAt":"2026-10-09T10:00:00Z", "updatedAt":"2026-10-09T10:00:00Z"
            }))
            .unwrap(),
        );
        Aggregate::from_wire(&fields).unwrap()
    }
    fn tx(index: u32, kind: &str, amount: i64, category: Option<&str>) -> Aggregate {
        aggregate(
            index,
            json!({"aggregateType":"transaction", "accountId":"40000000-0000-4000-8000-000000000001",
            "date":"2026-10-09","amount":amount,"kind":kind,"clearance":"cleared",
            "splits":category.map(|id|vec![json!({"id":"40000000-0000-4000-8000-000000000009","categoryId":id,"amount":amount})]).unwrap_or_default()}),
        )
    }
    #[test]
    fn f01_and_refunds_keep_balances_and_consumption_separate() {
        let mut all = vec![
            aggregate(
                2,
                json!({"aggregateType":"categoryGroup","name":"Ausgaben","kind":"expense","sortOrder":0,"archived":false}),
            ),
            aggregate(
                3,
                json!({"aggregateType":"categoryGroup","name":"Einnahmen","kind":"income","sortOrder":1,"archived":false}),
            ),
            aggregate(
                4,
                json!({"aggregateType":"category","name":"Lebensmittel","groupId":"40000000-0000-4000-8000-000000000002","sortOrder":0,"archived":false}),
            ),
            aggregate(
                5,
                json!({"aggregateType":"category","name":"Gehalt","groupId":"40000000-0000-4000-8000-000000000003","sortOrder":1,"archived":false}),
            ),
            tx(10, "opening", 100000, None),
            tx(
                11,
                "normal",
                -10000,
                Some("40000000-0000-4000-8000-000000000004"),
            ),
            tx(
                12,
                "normal",
                20000,
                Some("40000000-0000-4000-8000-000000000005"),
            ),
        ];
        assert_eq!(typed_balances(&all).unwrap()[0].balance.cents(), 110000);
        let consumption = typed_consumption(&all).unwrap();
        assert_eq!(
            (
                consumption.income.cents(),
                consumption.expense.cents(),
                consumption.net.cents()
            ),
            (20000, 10000, 10000)
        );
        all.push(tx(
            13,
            "normal",
            2500,
            Some("40000000-0000-4000-8000-000000000004"),
        ));
        let mut deleted = tx(
            14,
            "normal",
            -9999,
            Some("40000000-0000-4000-8000-000000000004"),
        );
        if let Aggregate::Transaction(tx) = &mut deleted {
            tx.deleted_at =
                Some(crate::scalars::UtcTimestamp::new("2026-10-09T10:00:00Z".into()).unwrap());
        }
        all.push(deleted);
        assert_eq!(typed_balances(&all).unwrap()[0].balance.cents(), 112500);
        assert_eq!(typed_consumption(&all).unwrap().expense.cents(), 7500);
        let original = serde_json::to_value(typed_consumption(&all).unwrap()).unwrap();
        all.reverse();
        assert_eq!(
            serde_json::to_value(typed_consumption(&all).unwrap()).unwrap(),
            original
        );
    }
    #[test]
    fn intermediate_overflow_is_rejected_even_when_final_balance_would_fit() {
        let mut all = vec![
            tx(10, "opening", MAX_SAFE, None),
            tx(11, "opening", 1, None),
            tx(12, "opening", -1, None),
        ];
        assert_eq!(
            typed_balances(&all).unwrap_err(),
            (
                "MONEY_OVERFLOW",
                "Der Kontostand überschreitet den sicheren Centbereich."
            )
        );
        all.reverse();
        assert_eq!(typed_balances(&all).unwrap_err().0, "MONEY_OVERFLOW");
    }
    #[test]
    fn typed_split_validation_rejects_duplicate_ids_and_unbalanced_amounts() {
        let Aggregate::Transaction(mut tx) = tx(
            10,
            "normal",
            -100,
            Some("40000000-0000-4000-8000-000000000004"),
        ) else {
            unreachable!()
        };
        assert!(crate::state_validation::typed_transaction(&tx).is_ok());
        tx.splits.push(tx.splits[0].clone());
        assert_eq!(
            crate::state_validation::typed_transaction(&tx)
                .unwrap_err()
                .0,
            "DUPLICATE_REFERENCE"
        );
        tx.splits.pop();
        tx.amount = MoneyCents::new(-99).unwrap();
        assert_eq!(
            crate::state_validation::typed_transaction(&tx)
                .unwrap_err()
                .1,
            "Die Splitsumme muss exakt dem Buchungsbetrag entsprechen."
        );
    }
}
