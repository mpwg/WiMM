// SPDX-License-Identifier: AGPL-3.0-or-later
import {expect,it} from 'vitest';
import {StoragePersistenceApplication} from './storage-persistence.js';
import type {StoragePersistenceOutcome} from '@wimm/contracts';
it.each<StoragePersistenceOutcome>([{supported:true,status:'granted'},{supported:true,status:'denied'},{supported:false,status:'unsupported'},{supported:true,status:'error'}])('trennt den tatsächlichen Portausgang $status und fragt pro Laufzeit nur einmal an',async(outcome)=>{
 let requests=0;const app=new StoragePersistenceApplication({request:async()=>{requests++;return outcome;}});expect(app.getSnapshot().status).toBe('unknown');
 await Promise.all([app.start(),app.start()]);expect(app.getSnapshot()).toEqual(outcome);expect(requests).toBe(1);
 await app.start();expect(requests).toBe(1);
});
it('weist API-Fehler als Fehler aus und erlaubt einen ausdrücklichen Wiederholversuch',async()=>{
 let calls=0;const app=new StoragePersistenceApplication({request:async()=>{if(++calls===1)throw new Error('Synthetischer API-Fehler');return {supported:true,status:'granted'};}});
 await app.start();expect(app.getSnapshot()).toEqual({supported:true,status:'error'});await app.retry();expect(app.getSnapshot()).toEqual({supported:true,status:'granted'});expect(calls).toBe(2);
});
it('verhindert doppelte Anfrage auch bei erneutem Start aus einem Beobachter',async()=>{
 let calls=0;const app=new StoragePersistenceApplication({request:async()=>{calls++;return {supported:true,status:'denied'};}});const stop=app.subscribe(()=>{void app.start();});await app.start();stop();expect(calls).toBe(1);expect(app.getSnapshot().status).toBe('denied');
});
