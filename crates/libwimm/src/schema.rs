diesel::table! {
    accounts (id) {
        id -> Text,
        name -> Text,
        currency -> Text,
    }
}
diesel::table! {
    bookings (id) {
        id -> Text,
        account_id -> Text,
        booking_date -> Text,
        description -> Text,
        amount -> BigInt,
    }
}
diesel::joinable!(bookings -> accounts (account_id));
diesel::allow_tables_to_appear_in_same_query!(accounts, bookings);
