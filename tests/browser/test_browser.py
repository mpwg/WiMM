"""Real-worker SQLite/OPFS acceptance tests. Serve this directory on localhost first."""
import argparse
import tempfile
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument("--url", default="http://localhost:8765")
parser.add_argument("--browser", choices=["all", "chromium", "firefox", "webkit"], default="all")
args = parser.parse_args()

SETUP = """async () => {
  window.db = await WiMM.open('acceptance');
  await db.replaceFromJson(JSON.stringify({format_version:1,accounts:[],bookings:[]}));
  window.assert = (condition, message) => { if (!condition) throw Error(message); };
  window.expectCode = async (operation, code) => {
    try { await operation(); } catch (e) { assert(e.code === code, `expected ${code}, got ${e.code}: ${e.message}`); return; }
    throw Error(`expected ${code}`);
  };
  const a = await db.createAccount({name:'  Daily  ',currency:'EUR'});
  assert(a.name === 'Daily', 'name normalization');
  const other = await db.createAccount({name:'Other',currency:'JPY'});
  const b = await db.createBooking(a.id,{booking_date:'2026-10-16',description:'Lunch 🍜',amount:'-9223372036854775808'});
  assert(b.amount === '-9223372036854775808', 'exact i64 minimum');
  assert((await db.getBooking(a.id,b.id)).id === b.id, 'read booking');
  await expectCode(() => db.getBooking(other.id,b.id),'not_found');
  await expectCode(() => db.deleteBooking(other.id,b.id),'not_found');
  await expectCode(() => db.updateBooking(other.id,b.id,{booking_date:'2026-10-16',description:'x',amount:'1'}),'not_found');
  await expectCode(() => db.updateAccount(a.id,{name:'Daily',currency:'USD'}),'validation');
  await expectCode(() => db.createBooking(a.id,{booking_date:'2026-02-30',description:'x',amount:'1'}),'validation');
  for (const amount of ['0','01','9223372036854775808',10]) {
    await expectCode(() => db.createBooking(a.id,{booking_date:'2026-10-16',description:'x',amount}),'validation');
  }
  assert(await db.currencyMinorUnits('EUR') === 2, 'EUR minor units');
  assert(await db.currencyMinorUnits('JPY') === 0, 'JPY minor units');
  assert(await db.currencyMinorUnits('KWD') === 3, 'KWD minor units');
  assert(await db.currencyMinorUnits('CLF') === 4, 'CLF minor units');
  await db.updateAccount(a.id,{name:'Updated',currency:'EUR'});
  await db.updateBooking(a.id,b.id,{booking_date:'2026-10-15',description:'Updated',amount:'9223372036854775807'});
  const extra = await db.createBooking(a.id,{booking_date:'2026-10-15',description:'extra',amount:'1'});
  const bookings = await db.listBookings(a.id);
  assert(bookings[0].id < bookings[1].id, 'tie sorted by ID');
  await db.deleteBooking(a.id,extra.id);
  const backup = await db.exportJson();
  const bad = JSON.parse(backup); bad.bookings[0].account_id = '00000000-0000-0000-0000-000000000000';
  await expectCode(() => db.replaceFromJson(JSON.stringify(bad)),'invalid_import');
  await expectCode(() => db.replaceFromJson('{"format_version":99}'),'unsupported_format_version');
  assert(await db.exportJson() === backup, 'invalid import preserves database');
  await db.replaceFromJson(backup);
  assert(await db.exportJson() === backup, 'JSON roundtrip');
  await expectCode(() => WiMM.open('acceptance'),'busy');
  const separate = await WiMM.open('separate');
  await separate.close();
  return backup;
}"""

with sync_playwright() as playwright:
    browsers = [args.browser] if args.browser != "all" else ["chromium", "firefox", "webkit"]
    for name in browsers:
        profile = tempfile.TemporaryDirectory(prefix="libwimm-browser-")
        context = getattr(playwright, name).launch_persistent_context(profile.name, headless=True)
        try:
            page = context.new_page()
            page.goto(args.url)
            page.wait_for_load_state("networkidle")
            page.wait_for_function("window.ready === true")
            backup = page.evaluate(SETUP)
            # An independent page must also fail to acquire the open database.
            second = context.new_page()
            second.goto(args.url)
            second.wait_for_function("window.ready === true")
            assert second.evaluate("async () => { try { await WiMM.open('acceptance'); return 'opened'; } catch(e) { return e.code; } }") == "busy"
            second.close()
            # Reload without close: worker termination must release its lock and OPFS handles.
            page.reload()
            page.wait_for_load_state("networkidle")
            page.wait_for_function("window.ready === true")
            page.evaluate("async () => { window.db = await WiMM.open('acceptance'); }")
            assert page.evaluate("() => db.exportJson()") == backup
            page.evaluate("""async () => {
              const accounts = await db.listAccounts();
              for (const a of accounts) await db.deleteAccount(a.id);
              const exported = JSON.parse(await db.exportJson());
              if (exported.accounts.length || exported.bookings.length) throw Error('cascade failed');
              const close1 = db.close(); const close2 = db.close(); await Promise.all([close1,close2]);
              try { await db.listAccounts(); throw Error('closed client accepted call'); } catch(e) { if(e.code !== 'closed') throw e; }
              window.db = await WiMM.open('acceptance');
              if ((await db.listAccounts()).length) throw Error('close/reopen persistence failed');
              await db.close();
            }""")
            # Feature detection rejects unsupported environments without an in-memory fallback.
            page.evaluate("""async () => {
              Object.defineProperty(navigator, 'locks', {value:undefined, configurable:true});
              try { await WiMM.open('unsupported'); throw Error('missing feature accepted'); }
              catch(e) { if(e.code !== 'unsupported_browser') throw e; }
            }""")
            context.close()
            print(f"PASS {name}: CRUD, validation, exact amounts, import/export, reload persistence, exclusivity, close, feature detection", flush=True)
        finally:
            context.close()
            profile.cleanup()
