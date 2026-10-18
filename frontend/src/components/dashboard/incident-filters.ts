import type { Incident } from '@/types/api';
export function filterDemoIncidents(records:Incident[], query:{search?:string;status?:string;priority?:string;verification?:string;sort?:string}) {
  const search=query.search?.trim().toLowerCase()||'';
  const ranks={CRITICAL:4,HIGH:3,MEDIUM:2,LOW:1};
  return records.filter(i=>(!search||[i._id,i.emergencyType,i.description,i.reporterName,i.location?.address].filter(Boolean).join(' ').toLowerCase().includes(search))&&(!query.status||i.status===query.status)&&(!query.priority||i.priorityLevel===query.priority)&&(!query.verification||i.verification?.status===query.verification)).sort((a,b)=>{
    const time=new Date(a.createdAt).getTime()-new Date(b.createdAt).getTime();
    return (query.sort==='oldest'?time:query.sort==='newest'?-time:ranks[b.priorityLevel]-ranks[a.priorityLevel]||b.priorityScore-a.priorityScore||time)||a._id.localeCompare(b._id);
  });
}
