'use client';
import { useEffect,useState } from 'react';
import { NOTIFICATION_EVENT,clearLegacyNotificationStorage,notificationKey,notificationSummary,readNotificationState,notificationReadPending,notificationRequestVersion,storeSharedNotificationSummary,type NotificationSummary } from './sorting-notifications';

/** Mounted once by Navbar, so notifications continue across all app pages. */
export function useSortingNotifications(username:string,enabled:boolean):NotificationSummary{
  const [summary,setSummary]=useState<NotificationSummary>({count:0,items:[]});
  useEffect(()=>{
    if(!username||!enabled){setSummary({count:0,items:[]});return;}
    let disposed=false,inFlight=false;
    let initialized=false;
    let lastAttempt=0;
    const pollKey=notificationKey(username)+':poll-at';
    const controller=new AbortController();
    const audio=new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    clearLegacyNotificationStorage();
    const sync=()=>{if(!disposed)setSummary(notificationSummary(readNotificationState(username)));};
    const onChange=(event:Event)=>{if((event as CustomEvent<{username:string}>).detail?.username===username)sync();};
    const onStorage=(event:StorageEvent)=>{if(event.key===null||event.key===notificationKey(username))sync();};
    const pollOnce=async()=>{
      if(disposed||inFlight||notificationReadPending(username)||document.visibilityState!=='visible')return;
      if(Date.now()-lastAttempt<2000)return;
      try{const last=Number(localStorage.getItem(pollKey)||0);if(last>0&&Date.now()-last>=0&&Date.now()-last<25000)return;}catch{/* Storage is optional. */}
      lastAttempt=Date.now();inFlight=true;
      const requestVersion=notificationRequestVersion(username);
      try{
        const response=await fetch('/api/order/notifications',{cache:'no-store',signal:controller.signal});
        if(!response.ok)return;
        const next:NotificationSummary=await response.json();
        if(disposed||requestVersion!==notificationRequestVersion(username)||notificationReadPending(username)||!Array.isArray(next.items))return;
        const previous=readNotificationState(username).notices;
        if(initialized&&next.items.some(n=>!previous.some(p=>p.id===n.id&&p.updatedAt===n.updatedAt)))void audio.play().catch(()=>{});
        initialized=true;storeSharedNotificationSummary(username,next);
        try{localStorage.setItem(pollKey,String(Date.now()));}catch{/* Server still merges simultaneous polls. */}
      }catch{/* Preserve unread notices when offline, unauthenticated, or aborted. */}
      finally{inFlight=false;}
    };
    const poll=async()=>{
      // One poll per user across same-origin tabs; local storage shares its result.
      if(navigator.locks){await navigator.locks.request(pollKey,{ifAvailable:true},async lock=>{if(lock)await pollOnce();});}
      else await pollOnce();
    };
    const onVisible=()=>{sync();void poll();};
    sync();void poll();
    const timer=window.setInterval(()=>void poll(),30000);
    window.addEventListener(NOTIFICATION_EVENT,onChange);
    window.addEventListener('storage',onStorage);
    window.addEventListener('focus',onVisible);
    document.addEventListener('visibilitychange',onVisible);
    return()=>{disposed=true;controller.abort();audio.pause();window.clearInterval(timer);window.removeEventListener(NOTIFICATION_EVENT,onChange);window.removeEventListener('storage',onStorage);window.removeEventListener('focus',onVisible);document.removeEventListener('visibilitychange',onVisible);};
  },[username,enabled]);
  return summary;
}
