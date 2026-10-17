"use client";

import type { Incident } from "@/types/api";
import {
  X,
  MapPin,
  Clock,
  AlertTriangle,
  Users,
  Activity,
  Droplets,
  CheckCircle2,
} from "lucide-react";
import Image from "next/image";

interface IncidentDetailModalProps {
  incident: Incident | null;
  onClose: () => void;
  onUpdateStatus?: (id: string, status: Incident["status"]) => void;
}

export function IncidentDetailModal({
  incident,
  onClose,
  onUpdateStatus,
}: IncidentDetailModalProps) {
  if (!incident) return null;

  const isCritical = incident.priorityLevel === "CRITICAL";
  const isHigh = incident.priorityLevel === "HIGH";

  const getThumbnail = () => {
    if (incident.emergencyType === "FLOOD") return "/images/incidents/urban-flooding.jpg";
    if (incident.emergencyType === "STRANDED") return "/images/incidents/building-collapse.jpg";
    if (incident.emergencyType === "OTHER") return "/images/incidents/fallen-tree.jpg";
    return "/images/incidents/water-logging.jpg";
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-incident-title"
    >
      <div className="bg-[#0B1D33] border border-[#203650] rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Top Banner with Image */}
        <div className="relative h-44 w-full bg-[#07182B] overflow-hidden">
          <Image
            src={getThumbnail()}
            alt={incident.emergencyType}
            fill
            sizes="(max-width: 768px) 100vw, 600px"
            className="object-cover opacity-80"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B1D33] via-[#0B1D33]/40 to-transparent" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 hover:bg-black/80 border border-white/10 flex items-center justify-center text-white transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Banner Tags */}
          <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className={`text-xs font-bold px-2.5 py-1 rounded-md uppercase tracking-wider ${
                  isCritical
                    ? "bg-[#F04452] text-white shadow-lg shadow-[#F04452]/40"
                    : isHigh
                      ? "bg-[#F5B942] text-black"
                      : "bg-[#2378F6] text-white"
                }`}
              >
                {incident.priorityLevel}
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[#122A45] text-[#EAF3FF] border border-[#203650]">
                {incident.emergencyType}
              </span>
            </div>
            <span className="text-xs font-medium text-[#EAF3FF] bg-black/50 backdrop-blur-sm px-2.5 py-1 rounded-full border border-white/10">
              Score: <strong>{incident.priorityScore} / 100</strong>
            </span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 text-sm text-[#EAF3FF]">
          <div>
            <h3 id="modal-incident-title" className="text-lg font-bold text-[#EAF3FF] leading-snug">
              {incident.description}
            </h3>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-[#91A8C2]">
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-[#2378F6]" />
                <span>
                  {incident.location?.address || "Location verification required"}
                </span>
              </span>
              <span>&bull;</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-[#627D98]" />
                <span>Reported by {incident.reporterName}</span>
              </span>
            </div>
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
            <div className="bg-[#07182B] p-2.5 rounded-lg border border-[#162B42]">
              <div className="flex items-center gap-1.5 text-[11px] text-[#91A8C2] mb-1">
                <Users className="w-3 h-3 text-[#18C785]" />
                <span>Affected</span>
              </div>
              <div className="text-base font-bold font-mono">
                {incident.peopleAffected} People
              </div>
            </div>

            <div className="bg-[#07182B] p-2.5 rounded-lg border border-[#162B42]">
              <div className="flex items-center gap-1.5 text-[11px] text-[#91A8C2] mb-1">
                <Droplets className="w-3 h-3 text-[#2378F6]" />
                <span>Water Level</span>
              </div>
              <div className="text-base font-bold">
                {incident.waterLevel || "UNKNOWN"}
              </div>
            </div>

            <div className="bg-[#07182B] p-2.5 rounded-lg border border-[#162B42]">
              <div className="flex items-center gap-1.5 text-[11px] text-[#91A8C2] mb-1">
                <AlertTriangle className="w-3 h-3 text-[#F04452]" />
                <span>Danger Flag</span>
              </div>
              <div className="text-base font-bold">
                {incident.immediateDanger ? "CRITICAL" : "STABLE"}
              </div>
            </div>

            <div className="bg-[#07182B] p-2.5 rounded-lg border border-[#162B42]">
              <div className="flex items-center gap-1.5 text-[11px] text-[#91A8C2] mb-1">
                <Activity className="w-3 h-3 text-[#F5B942]" />
                <span>Confidence</span>
              </div>
              <div className="text-base font-bold">
                {incident.confidenceLevel}
              </div>
            </div>
          </div>

          {/* Vulnerable Breakdown */}
          {incident.vulnerablePeople && (
            <div className="bg-[#07182B]/60 p-3 rounded-lg border border-[#162B42]">
              <span className="text-xs font-semibold text-[#91A8C2] uppercase tracking-wider block mb-2">
                Vulnerable Demographics
              </span>
              <div className="grid grid-cols-4 gap-2 text-xs">
                <div>
                  <span className="text-[#627D98] block">Elderly</span>
                  <span className="font-bold text-[#EAF3FF]">
                    {incident.vulnerablePeople.elderly ?? 0}
                  </span>
                </div>
                <div>
                  <span className="text-[#627D98] block">Children</span>
                  <span className="font-bold text-[#EAF3FF]">
                    {incident.vulnerablePeople.children ?? 0}
                  </span>
                </div>
                <div>
                  <span className="text-[#627D98] block">Disabled</span>
                  <span className="font-bold text-[#EAF3FF]">
                    {incident.vulnerablePeople.disabled ?? 0}
                  </span>
                </div>
                <div>
                  <span className="text-[#627D98] block">Medical Needs</span>
                  <span className="font-bold text-[#F04452]">
                    {incident.vulnerablePeople.medicalNeeds ?? 0}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Priority Reasons */}
          {incident.priorityReasons && incident.priorityReasons.length > 0 && (
            <div className="bg-[#07182B]/60 p-3 rounded-lg border border-[#162B42]">
              <span className="text-xs font-semibold text-[#91A8C2] uppercase tracking-wider block mb-2">
                Risk Factor Analysis
              </span>
              <ul className="space-y-1 text-xs text-[#91A8C2]">
                {incident.priorityReasons.map((reason, idx) => (
                  <li key={idx} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#2378F6]" />
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Operational Simulation Notice */}
          <div className="text-[11px] text-[#627D98] border-t border-[#162B42] pt-3 flex items-center justify-between">
            <span>Prototype Decision Support &bull; Human Confirmation Required</span>
            {incident.isSimulated && (
              <span className="text-[#F5B942] font-semibold">SIMULATED INCIDENT</span>
            )}
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 bg-[#07182B] border-t border-[#203650] flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-[#122A45] hover:bg-[#183659] text-xs font-medium text-[#EAF3FF] transition-colors"
          >
            Close
          </button>

          {onUpdateStatus && incident.status !== "RESOLVED" && (
            <button
              onClick={() => {
                onUpdateStatus(incident._id, "RESOLVED");
                onClose();
              }}
              className="px-4 py-2 rounded-lg bg-[#18C785] hover:bg-[#15B075] text-xs font-bold text-white flex items-center gap-1.5 transition-colors shadow-md shadow-[#18C785]/20"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Mark Resolved</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
