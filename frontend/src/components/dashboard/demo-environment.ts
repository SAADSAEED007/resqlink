import type { Assignment, Capability, Incident, IncidentStatus, PriorityLevel, RescueTeam, VerificationStatus } from '@/types/api';
import { MOCK_ASSIGNMENTS, MOCK_INCIDENTS, MOCK_RESCUE_TEAMS, type ActivityItem } from './mock-data';

export interface DemoEnvironment { incidents: Incident[]; teams: RescueTeam[]; assignments: Assignment[]; activity: ActivityItem[] }
export type DemoAction =
  | { type:'assign'; incidentId:string; teamId:string }
  | { type:'status'; incidentId:string; status:IncidentStatus }
  | { type:'priority'; incidentId:string; priority:PriorityLevel; reason:string }
  | { type:'verify'; incidentId:string; status:VerificationStatus; notes:string }
  | { type:'availability'; teamId:string; status:'AVAILABLE'|'OFFLINE' }
  | { type:'reset' };
const capabilities: Record<Incident['emergencyType'], Capability[]> = { FLOOD:['WATER_RESCUE'], MEDICAL:['MEDICAL'], FIRE:['FIRE_RESPONSE'], STRANDED:['EVACUATION','WATER_RESCUE'], SUPPLIES:['SUPPLY_DELIVERY'], OTHER:['EVACUATION'] };
export function eligibleDemoTeam(incident:Incident, team:RescueTeam) {
  return incident.isSimulated && team.isSimulated && incident.status==='PENDING' && !incident.assignedTeam && team.status==='AVAILABLE' && !team.currentIncident && capabilities[incident.emergencyType].some(cap=>team.capabilities.includes(cap));
}
export function createDemoEnvironment():DemoEnvironment {
  const state:DemoEnvironment=structuredClone({incidents:MOCK_INCIDENTS,teams:MOCK_RESCUE_TEAMS,assignments:MOCK_ASSIGNMENTS,activity:[]});
  // Existing fixtures include assignments whose incident still says Pending.
  // Normalize those relationships once so all views start from the same scenario.
  for(const assignment of state.assignments) {
    const incident=state.incidents.find(i=>i._id===assignment.incidentId);
    const team=state.teams.find(t=>t._id===assignment.teamId);
    if(assignment.status==='ACTIVE' && incident && team) { if(incident.status==='PENDING') incident.status='ASSIGNED'; incident.assignedTeam=team._id; team.status='BUSY'; team.currentIncident=incident._id; }
  }
  for(const incident of state.incidents) {
    if(!['ASSIGNED','IN_PROGRESS'].includes(incident.status)||!incident.assignedTeam||state.assignments.some(a=>a.incidentId===incident._id&&a.status==='ACTIVE')) continue;
    let team=state.teams.find(t=>t._id===incident.assignedTeam);
    if(team && !capabilities[incident.emergencyType].some(cap=>team!.capabilities.includes(cap))) {
      team=state.teams.find(t=>t.status==='AVAILABLE'&&!t.currentIncident&&capabilities[incident.emergencyType].some(cap=>t.capabilities.includes(cap)));
      incident.assignedTeam=team?._id||null;
    }
    if(!team || (team.currentIncident && team.currentIncident!==incident._id)) {incident.status='PENDING';incident.assignedTeam=null;continue;}
    team.status='BUSY';team.currentIncident=incident._id;
    state.assignments.push({_id:`demo-seed-${incident._id}`,incidentId:incident._id,teamId:team._id,assignedAt:incident.updatedAt,completedAt:null,status:'ACTIVE',isSimulated:true,createdAt:incident.updatedAt,updatedAt:incident.updatedAt});
  }
  return state;
}
export function applyDemoAction(current:DemoEnvironment, action:DemoAction, timestamp=new Date().toISOString()):DemoEnvironment {
  if(action.type==='reset') return createDemoEnvironment();
  const next=structuredClone(current);
  const incident='incidentId' in action ? next.incidents.find(i=>i._id===action.incidentId) : undefined;
  const team='teamId' in action ? next.teams.find(t=>t._id===action.teamId) : undefined;
  if(('incidentId' in action && !incident?.isSimulated)||('teamId' in action && !team?.isSimulated)) throw new Error('Select a current simulated record.');
  const previousStatus=incident?.status;
  let title='Simulation updated'; let iconType:ActivityItem['iconType']='alert';
  if(action.type==='availability') {
    if(!team || team.status==='BUSY' || team.currentIncident || next.assignments.some(a=>a.teamId===team._id&&a.status==='ACTIVE')) throw new Error('Complete the active assignment before changing team availability.');
    team.status=action.status; team.updatedAt=timestamp; title=`${team.name} set ${action.status.toLowerCase()} in simulation`;
  } else if(incident) {
    if(['RESOLVED','CANCELLED'].includes(incident.status)) throw new Error('This simulated incident is closed.');
    if(action.type==='assign') {
      if(!team || !eligibleDemoTeam(incident,team)) throw new Error('Incident or team is no longer eligible for assignment.');
      const assignment:Assignment={_id:`demo-assignment-${next.assignments.length+1}`,incidentId:incident._id,teamId:team._id,status:'ACTIVE',assignedAt:timestamp,completedAt:null,createdAt:timestamp,updatedAt:timestamp,isSimulated:true};
      next.assignments.unshift(assignment); incident.status='ASSIGNED'; incident.assignedTeam=team._id; team.status='BUSY'; team.currentIncident=incident._id; team.updatedAt=timestamp; title=`${team.name} assigned in simulation`; iconType='assignment';
    } else if(action.type==='status') {
      const transitions:Record<IncidentStatus,IncidentStatus[]>={PENDING:['CANCELLED'],ASSIGNED:['IN_PROGRESS','CANCELLED'],IN_PROGRESS:['RESOLVED'],RESOLVED:[],CANCELLED:[]};
      if(!transitions[incident.status].includes(action.status)) throw new Error('Invalid simulated incident status transition.');
      incident.status=action.status; title=`Incident marked ${action.status.replaceAll('_',' ')} in simulation`;
      if(['RESOLVED','CANCELLED'].includes(action.status)) {
        const active=next.assignments.filter(a=>a.incidentId===incident._id&&a.status==='ACTIVE');
        for(const assignment of active) {assignment.status=action.status==='RESOLVED'?'COMPLETED':'CANCELLED';assignment.completedAt=timestamp;assignment.updatedAt=timestamp;const assigned=next.teams.find(t=>t._id===assignment.teamId);if(assigned){assigned.status='AVAILABLE';assigned.currentIncident=null;assigned.updatedAt=timestamp;}}
        incident.assignedTeam=null; iconType='resolved';
      }
    } else if(action.type==='priority') {
      if(action.reason.trim().length<5) throw new Error('Explain the priority review.');
      const score={CRITICAL:75,HIGH:50,MEDIUM:25,LOW:0}[action.priority];
      incident.priorityOverrides.push({previousPriority:incident.priorityLevel,newPriority:action.priority,previousScore:incident.priorityScore,newScore:score,reason:action.reason,coordinatorId:'demo-coordinator',timestamp});
      incident.priorityLevel=action.priority;incident.priorityScore=score;
      if(incident.triage) {incident.triage.status='COORDINATOR_REVIEWED';incident.triage.reviewedAt=timestamp;incident.triage.reviewedBy='demo-coordinator';}
      title=`Priority reviewed as ${action.priority} in simulation`;
    } else if(action.type==='verify') {
      if(action.notes.trim().length<3) throw new Error('Add verification review notes.');
      incident.verification={...incident.verification,status:action.status,requiresManualReview:action.status!=='VERIFIED',isPotentialDuplicate:incident.verification?.isPotentialDuplicate??false,potentialDuplicateIncidents:incident.verification?.potentialDuplicateIncidents??[],missingFields:incident.verification?.missingFields??[],warnings:incident.verification?.warnings??[],reviewedBy:'demo-coordinator',reviewedAt:timestamp,reviewNotes:action.notes};
      title=`Incident verification ${action.status} in simulation`;
    }
    if(previousStatus && previousStatus!==incident.status) {
      incident.statusHistory=[...(incident.statusHistory||[]),{previousStatus,newStatus:incident.status,timestamp,changedBy:'demo-coordinator'}];
    }
    incident.updatedAt=timestamp;
  }
  next.activity.unshift({id:`demo-event-${next.activity.length+1}`,timestamp,timeAgo:'Just now',title,subtitle:incident?`Incident ${incident._id.slice(-6)}`:team?.teamCode||'Simulation',iconType,statusText:'Simulated',statusTone:'blue'});
  return next;
}
