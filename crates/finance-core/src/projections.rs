// SPDX-License-Identifier: AGPL-3.0-or-later
//! Reproduzierbare Basisprojektionen mit exakten geprüften Zwischenwerten.
use crate::{
    CoreResult, MAX_SAFE,
    aggregate_schema::{array, integer, kind, live, string},
};
use serde_json::{Value, json};
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
pub fn consumption(all: &[Value]) -> CoreResult<Value> {
    let by_id: BTreeMap<&str, &Value> = all
        .iter()
        .map(|a| Ok((string(&a["id"])?, a)))
        .collect::<CoreResult<_>>()?;
    let mut transactions: Vec<_> = all
        .iter()
        .filter(|a| kind(a) == "transaction" && live(a) && a["kind"] == "normal")
        .collect();
    transactions.sort_by(|a, b| {
        uuid_order(
            a["id"].as_str().unwrap_or(""),
            b["id"].as_str().unwrap_or(""),
        )
    });
    let mut amounts = Vec::<(&str, String, Vec<i64>)>::new();
    let mut category_index = BTreeMap::<&str, usize>::new();
    let (mut income, mut raw_expense) = (0, 0);
    for tx in transactions {
        for split in array(&tx["splits"])? {
            let id = string(&split["categoryId"])?;
            let category = by_id.get(id).ok_or(("INVALID_AGGREGATE","Eine Verbrauchsprojektion benötigt jede referenzierte Kategorie und Kategoriegruppe."))?;
            let group = by_id.get(string(&category["groupId"])?).ok_or(("INVALID_AGGREGATE","Eine Verbrauchsprojektion benötigt jede referenzierte Kategorie und Kategoriegruppe."))?;
            let amount = integer(&split["amount"])?;
            let group_kind = string(&group["kind"])?;
            let index = *category_index.entry(id).or_insert_with(|| {
                amounts.push((id, group_kind.to_string(), vec![]));
                amounts.len() - 1
            });
            amounts[index].2.push(amount);
            if group_kind == "income" {
                income = add(
                    income,
                    amount,
                    "Die Einnahmensumme überschreitet den sicheren Centbereich.",
                )?;
            } else {
                raw_expense = add(
                    raw_expense,
                    amount,
                    "Die Ausgabensumme überschreitet den sicheren Centbereich.",
                )?;
            }
        }
    }
    let expense = -raw_expense;
    let net = add(
        income,
        -expense,
        "Der Verbrauchssaldo überschreitet den sicheren Centbereich.",
    )?;
    let mut categories = Vec::new();
    for (id, group_kind, values) in amounts {
        let mut total = 0;
        for value in values {
            total = add(
                total,
                value,
                "Die Kategoriesumme überschreitet den sicheren Centbereich.",
            )?;
        }
        categories.push(json!({"categoryId":id,"groupKind":group_kind,"amount":total}));
    }
    categories.sort_by(|a, b| {
        uuid_order(
            a["categoryId"].as_str().unwrap_or(""),
            b["categoryId"].as_str().unwrap_or(""),
        )
    });
    Ok(json!({"income":income,"expense":expense,"net":net,"categories":categories}))
}
trait SortTransactions<'a> {
    fn tap_sort(self) -> Vec<&'a Value>;
}
impl<'a> SortTransactions<'a> for Vec<&'a Value> {
    fn tap_sort(mut self) -> Self {
        self.sort_by(|a, b| {
            uuid_order(
                a["id"].as_str().unwrap_or(""),
                b["id"].as_str().unwrap_or(""),
            )
        });
        self
    }
}
pub fn balances(all: &[Value]) -> CoreResult<Vec<Value>> {
    let mut balances = BTreeMap::<&str, i64>::new();
    let transactions = all
        .iter()
        .filter(|a| kind(a) == "transaction" && live(a))
        .collect::<Vec<_>>()
        .tap_sort();
    for tx in transactions {
        let account = string(&tx["accountId"])?;
        let old = balances.get(account).copied().unwrap_or(0);
        balances.insert(
            account,
            add(
                old,
                integer(&tx["amount"])?,
                "Der Kontostand überschreitet den sicheren Centbereich.",
            )?,
        );
    }
    let mut balances: Vec<_> = balances.into_iter().collect();
    balances.sort_by(|a, b| uuid_order(a.0, b.0));
    let account_balances: Vec<_> = balances
        .into_iter()
        .map(|(id, balance)| json!({"accountId":id,"balance":balance}))
        .collect();
    Ok(account_balances)
}
pub fn rebuild(all: &[Value]) -> CoreResult<Value> {
    Ok(json!({"accountBalances":balances(all)?,"consumption":consumption(all)?}))
}
