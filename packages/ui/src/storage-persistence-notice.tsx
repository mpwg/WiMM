// SPDX-License-Identifier: AGPL-3.0-or-later
import {useEffect,useSyncExternalStore} from 'react';
import type {UnlockedAppContext} from './app.js';
import {Button} from './components.js';

export function StoragePersistenceNotice({context,details=false}:{readonly context:UnlockedAppContext;readonly details?:boolean}){
 const controller=context.runtime.persistence!;
 const state=useSyncExternalStore(controller.subscribe,controller.getSnapshot);
 useEffect(()=>{void controller.start();},[controller]);
 if(!details&&['unknown','requesting','granted'].includes(state.status))return null;
 const messages={unknown:'Der Speicherstatus wird geprüft.',requesting:'Dauerhafte Browserspeicherung wird angefragt.',granted:'Der Browser hat dauerhafte Speicherung zugesagt.',denied:'Der Browser hat dauerhafte Speicherung nicht zugesagt. Ihre Daten bleiben lokal verfügbar, können aber vom Browser entfernt werden.',unsupported:'Dieser Browser bietet keine Anfrage für dauerhafte Speicherung. Ihre Daten bleiben lokal verfügbar.',error:'Dauerhafte Browserspeicherung konnte nicht angefragt werden. Ihre vorhandenen Daten bleiben unverändert.'};
 return <section className="notice storage-notice" aria-label="Browserspeicherung" data-persistence-status={state.status}>
  <p aria-live="polite">{messages[state.status]}</p>
  {state.status==='granted'||state.status==='unknown'||state.status==='requesting'?null:<p className="help-text">Bewahren Sie eine separate Sicherung Ihres Browserprofils mit dem verschlüsselten Tresor auf. Eine Bereichssicherung allein ersetzt diese nicht.</p>}
  {['denied','error'].includes(state.status)?<Button variant="quiet" disabled={context.profileChanging} onClick={()=>void controller.retry()}>Dauerhafte Speicherung erneut anfragen</Button>:null}
 </section>;
}
