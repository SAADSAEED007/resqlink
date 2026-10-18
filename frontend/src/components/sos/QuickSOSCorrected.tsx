"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  Flame,
  HeartPulse,
  HelpCircle,
  MapPinned,
  Mic,
  Navigation,
  ShieldAlert,
  ShieldCheck,
  Siren,
  TriangleAlert,
  Waves,
} from "lucide-react";
import { Button, Input, Select, Textarea } from "@/components/ui";
import { incidents } from "@/lib/api/incidents";
import type { EmergencyType } from "@/types/api";
import {
  emergencyChoices,
  emptyDraft,
  locationSummary,
  selectedLocation,
  toIncidentInput,
  validateDetails,
  validateLocation,
  type DraftErrors,
  type SOSDraft,
} from "./report";
import "./sos.css";

const MapPicker = dynamic(() => import("./SOSMapPicker"), { ssr: false });

type Language = "en" | "ur" | "sd";
type Screen = "start" | "wizard" | "success";
type WizardStep = 1 | 2 | 3 | 4;

const words = {
  en: {
    portalBack: "Back to public portal",
    wizardTitle: "Quick Emergency Report",
    wizardSubtitle: "Tell us what happened and where help is needed.",
    prototypeNotice:
      "Demonstration system. Not connected to official emergency dispatch. In a real emergency, contact local emergency services.",
    step1Label: "Emergency",
    step2Label: "Danger",
    step3Label: "Location",
    step4Label: "Send SOS",
    step1Title: "What happened?",
    step1Subtitle: "Select the type of emergency.",
    step2Title: "Is anyone in immediate danger?",
    step2Optional: "Quick safety check · Optional",
    step2Helper:
      "This helps coordinators understand how urgently the report may need review.",
    dangerYes: "Yes, immediate danger",
    dangerYesDesc: "People are trapped, unconscious, or in life-threatening peril",
    dangerNo: "No known immediate danger",
    dangerNoDesc: "Emergency help is needed, but no immediate life threat",
    dangerUnsure: "I'm not sure",
    dangerUnsureDesc: "Situation is uncertain, unverified, or developing rapidly",
    dangerSkip: "Continue without answering",
    step3Title: "Where is the emergency?",
    step3Subtitle: "Share your location or select it on the map.",
    shareLocation: "Share My Location",
    findingLocation: "Finding your location…",
    chooseMap: "Choose on Map",
    orLandmark: "Or enter your village / landmark",
    landmarkPlaceholder: "Village, district, road, mosque or school",
    locationCaptured: "Location captured",
    locationOnMap: "Location selected on map",
    confirmLocationContinue: "Continue to Review",
    gpsDenied:
      "We couldn't access your location. Enter a village or landmark instead.",
    noLocationError: "Please share GPS coordinates or enter a landmark.",
    confirmedLocation: "Confirmed Location",
    step4Title: "Review & Send SOS",
    step4Subtitle:
      "Check your report and send it to the coordination dashboard.",
    summaryEmergency: "Emergency",
    summaryDanger: "Danger Assessment",
    summaryLocation: "Reported Location",
    summaryDetails: "Additional Details (Optional)",
    changeAction: "Change",
    editAction: "Edit",
    dangerReported: "Immediate danger reported",
    dangerNone: "No known immediate danger",
    dangerUnknown: "Unsure about immediate danger",
    dangerUnanswered: "Unanswered (Optional)",
    descLabel: "What happened?",
    nameLabel: "Your name",
    peopleLabel: "People affected",
    waterLabel: "Water level",
    waterUnknown: "Not sure",
    waterLow: "Low",
    waterModerate: "Moderate",
    waterHigh: "High",
    sendSOS: "Send SOS Report",
    sendingSOS: "Sending SOS…",
    backAction: "Back",
    submissionError:
      "Your report was not recorded. Your details are still here. Please try again.",
    successTitle: "SOS Report Submitted",
    successSaved:
      "Your report has been recorded in this demonstration system. This does not contact official emergency services.",
    refLabel: "Your Report Reference",
    copyRef: "Copy Reference Number",
    copiedRef: "Reference Copied!",
    anotherReport: "Submit Another Report",
    startNeed: "Need Emergency Help?",
    startIntro: "Report an emergency in a few simple steps.",
    startNoAccount: "No account needed.",
    startTap: "Tap SOS to start a quick report.",
  },
  ur: {
    portalBack: "عوامی صفحے پر واپس",
    wizardTitle: "فوری ایمرجنسی رپورٹ",
    wizardSubtitle: "بتائیں کیا ہوا اور مدد کہاں چاہیے۔",
    prototypeNotice:
      "یہ نمائشی نظام ہے۔ یہ سرکاری ایمرجنسی سروس سے منسلک نہیں۔ حقیقی ایمرجنسی میں مقامی ایمرجنسی سروس سے رابطہ کریں۔",
    step1Label: "ایمرجنسی",
    step2Label: "خطرہ",
    step3Label: "مقام",
    step4Label: "بھیجیں",
    step1Title: "کیا ہوا؟",
    step1Subtitle: "ایمرجنسی کی قسم منتخب کریں۔",
    step2Title: "کیا کسی کی جان کو فوری خطرہ ہے؟",
    step2Optional: "فوری حفاظتی سوال · اختیاری",
    step2Helper:
      "اس سے رابطہ کار کو رپورٹ کی فوری نوعیت سمجھنے میں مدد ملتی ہے۔",
    dangerYes: "ہاں، فوری خطرہ ہے",
    dangerYesDesc: "لوگ پھنسے ہوئے ہیں یا جان کو فوری خطرہ لاحق ہے",
    dangerNo: "کسی فوری خطرے کا علم نہیں",
    dangerNoDesc: "مدد درکار ہے لیکن فوری جانی خطرہ معلوم نہیں",
    dangerUnsure: "یقین نہیں",
    dangerUnsureDesc: "صورتحال غیر واضح یا تیزی سے تبدیل ہو رہی ہے",
    dangerSkip: "جواب دیئے بغیر آگے بڑھیں",
    step3Title: "ایمرجنسی کہاں ہے؟",
    step3Subtitle: "اپنی جگہ شیئر کریں یا نقشے پر منتخب کریں۔",
    shareLocation: "میری جگہ شیئر کریں",
    findingLocation: "جگہ تلاش ہو رہی ہے…",
    chooseMap: "نقشے پر منتخب کریں",
    orLandmark: "یا گاؤں / نشانِ مقام لکھیں",
    landmarkPlaceholder: "گاؤں، ضلع، سڑک، مسجد یا اسکول",
    locationCaptured: "جگہ محفوظ ہو گئی",
    locationOnMap: "نقشے پر جگہ منتخب ہو گئی",
    confirmLocationContinue: "جائزے کے لیے آگے بڑھیں",
    gpsDenied:
      "ہم آپ کی جگہ حاصل نہیں کر سکے۔ گاؤں یا نشانِ مقام لکھیں۔",
    noLocationError: "براہ کرم اپنی جگہ شیئر کریں یا گاؤں / نشان لکھیں۔",
    confirmedLocation: "تصدیق شدہ مقام",
    step4Title: "جائزہ لیں اور SOS بھیجیں",
    step4Subtitle: "اپنی رپورٹ چیک کریں اور رابطہ کار کو بھیجیں۔",
    summaryEmergency: "ایمرجنسی",
    summaryDanger: "خطرے کی نوعیت",
    summaryLocation: "منتخب مقام",
    summaryDetails: "مزید تفصیل (اختیاری)",
    changeAction: "تبدیل کریں",
    editAction: "ترمیم کریں",
    dangerReported: "فوری خطرے کی اطلاع",
    dangerNone: "کسی فوری خطرے کا علم نہیں",
    dangerUnknown: "فوری خطرے کے بارے میں یقین نہیں",
    dangerUnanswered: "کوئی جواب نہیں (اختیاری)",
    descLabel: "کیا ہوا؟",
    nameLabel: "آپ کا نام",
    peopleLabel: "متاثرہ افراد",
    waterLabel: "پانی کی سطح",
    waterUnknown: "معلوم نہیں",
    waterLow: "کم",
    waterModerate: "درمیانی",
    waterHigh: "زیادہ",
    sendSOS: "SOS رپورٹ بھیجیں",
    sendingSOS: "رپورٹ بھیجی جا رہی ہے…",
    backAction: "واپس",
    submissionError:
      "آپ کی رپورٹ درج نہیں ہو سکی۔ آپ کی تفصیلات محفوظ ہیں۔ براہ کرم دوبارہ کوشش کریں۔",
    successTitle: "SOS Report Submitted",
    successSaved:
      "آپ کی رپورٹ اس نمائشی نظام میں درج ہو گئی ہے۔ یہ سرکاری ایمرجنسی سروس سے رابطہ نہیں کرتا۔",
    refLabel: "آپ کا رپورٹ نمبر",
    copyRef: "رپورٹ نمبر نقل کریں",
    copiedRef: "نقل ہو گیا!",
    anotherReport: "نئی رپورٹ بھیجیں",
    startNeed: "فوری مدد چاہیے؟",
    startIntro: "چند آسان مراحل میں ایمرجنسی رپورٹ کریں۔",
    startNoAccount: "اکاؤنٹ کی ضرورت نہیں۔",
    startTap: "فوری رپورٹ شروع کرنے کے لیے SOS دبائیں۔",
  },
  sd: {
    portalBack: "عوامي صفحي تي واپس",
    wizardTitle: "تڪڙي ايمرجنسي رپورٽ",
    wizardSubtitle: "ٻڌايو ڇا ٿيو ۽ مدد ڪٿي گهرجي۔",
    prototypeNotice:
      "هي نموني وارو نظام آهي۔ سرڪاري ايمرجنسي ڊسپيچ سان ڳنڍيل ناهي۔ اصل ايمرجنسي ۾ مقامي خدمتن سان رابطو ڪريو۔",
    step1Label: "ايمرجنسي",
    step2Label: "خطرو",
    step3Label: "جاءِ",
    step4Label: "موڪليو",
    step1Title: "ڇا ٿيو؟",
    step1Subtitle: "ايمرجنسي جو قسم چونڊيو۔",
    step2Title: "ڇا ڪنهن جي جان کي فوري خطرو آهي؟",
    step2Optional: "تڪڙو حفاظتي سوال · اختياري",
    step2Helper: "هي رابطاڪار کي رپورٽ جي تڪڙ سمجھڻ ۾ مدد ڪري ٿو۔",
    dangerYes: "ها، فوري خطرو آهي",
    dangerYesDesc: "ماڻهو ڦاٿل آهن يا جان کي فوري خطرو آهي",
    dangerNo: "ڪنهن فوري خطري جي ڄاڻ ناهي",
    dangerNoDesc: "مدد گهربل آهي پر فوري جاني خطرو ناهي معلوم",
    dangerUnsure: "پڪ ناهي",
    dangerUnsureDesc: "صورتحال غير يقيني يا تيزي سان تبديل ٿي رهي آهي",
    dangerSkip: "جواب ڏيڻ کان سواءِ اڳتي وڌو",
    step3Title: "ايمرجنسي ڪٿي آهي؟",
    step3Subtitle: "پنهنجي جاءِ شيئر ڪريو يا نقشي تي چونڊيو۔",
    shareLocation: "منهنجي جاءِ شيئر ڪريو",
    findingLocation: "جاءِ ڳولي رهيا آهيون…",
    chooseMap: "نقشي تي چونڊيو",
    orLandmark: "يا ڳوٺ / نشان لکو",
    landmarkPlaceholder: "ڳوٺ، ضلعو، رستو، مسجد يا اسڪول",
    locationCaptured: "جاءِ محفوظ ٿي وئي",
    locationOnMap: "نقشي تي جاءِ چونڊجي وئي",
    confirmLocationContinue: "جائزي لاءِ اڳتي وڌو",
    gpsDenied:
      "اسان توهان جي جاءِ حاصل نه ڪري سگهياسين۔ ڳوٺ يا نشان لکو۔",
    noLocationError: "مهرباني ڪري پنهنجي جاءِ شيئر ڪريو يا ڳوٺ / نشان لکو۔",
    confirmedLocation: "تصديق ٿيل جاءِ",
    step4Title: "جائزو وٺو ۽ SOS موڪليو",
    step4Subtitle: "پنهنجي رپورٽ چيڪ ڪريو ۽ رابطاڪار کي موڪليو۔",
    summaryEmergency: "ايمرجنسي",
    summaryDanger: "خطي جو جائزو",
    summaryLocation: "چونڊيل جاءِ",
    summaryDetails: "وڌيڪ تفصيل (اختياري)",
    changeAction: "بدلايو",
    editAction: "درست ڪريو",
    dangerReported: "فوري خطري جي رپورٽ",
    dangerNone: "ڪنهن فوري خطري جي ڄاڻ ناهي",
    dangerUnknown: "فوري خطري بابت پڪ ناهي",
    dangerUnanswered: "ڪو به جواب نه (اختياري)",
    descLabel: "ڇا ٿيو؟",
    nameLabel: "توهان جو نالو",
    peopleLabel: "متاثر ماڻهو",
    waterLabel: "پاڻي جي سطح",
    waterUnknown: "معلوم ناهي",
    waterLow: "گهٽ",
    waterModerate: "درمياني",
    waterHigh: "تمام گهڻو",
    sendSOS: "SOS رپورٽ موڪليو",
    sendingSOS: "رپورٽ موڪلي رهيا آهيون…",
    backAction: "واپس",
    submissionError:
      "توهان جي رپورٽ درج نه ٿي سگهي۔ توهان جا تفصيل محفوظ آهن۔ مهرباني ڪري ٻيهر ڪوشش ڪريو۔",
    successTitle: "SOS Report Submitted",
    successSaved:
      "توهان جي رپورٽ هن نموني واري نظام ۾ درج ٿي وئي آهي۔ هي سرڪاري ايمرجنسي خدمتن سان رابطو نٿو ڪري۔",
    refLabel: "توهان جو رپورٽ نمبر",
    copyRef: "رپورٽ نمبر نقل ڪريو",
    copiedRef: "نقل ٿي ويو!",
    anotherReport: "ٻي رپورٽ موڪليو",
    startNeed: "فوري مدد گهرجي؟",
    startIntro: "ڪجھ سادن مرحلن ۾ ايمرجنسي رپورٽ ڪريو۔",
    startNoAccount: "اڪائونٽ جي ضرورت ناهي۔",
    startTap: "تڪڙي رپورٽ شروع ڪرڻ لاءِ SOS دٻايو۔",
  },
} as const;

const categoryDangerQuestions: Record<Language, Record<EmergencyType, string>> = {
  en: {
    FLOOD: "Are people trapped or in immediate danger from rising water?",
    MEDICAL: "Is anyone unconscious, not breathing normally, or facing an immediate life threat?",
    FIRE: "Are people trapped, injured, or threatened by a spreading fire?",
    STRANDED: "Is anyone seriously injured or trapped in a vehicle?",
    SUPPLIES: "Is anyone stranded in a dangerous situation or unable to reach safety?",
    OTHER: "Is anyone currently facing an immediate threat to life or serious injury?",
  },
  ur: {
    FLOOD: "کیا لوگ پھنسے ہوئے ہیں یا بڑھتے پانی سے فوری خطرے میں ہیں؟",
    MEDICAL: "کیا کوئی بے ہوش ہے، معمول کے مطابق سانس نہیں لے رہا، یا اس کی جان کو فوری خطرہ ہے؟",
    FIRE: "کیا لوگ پھنسے ہوئے، زخمی یا پھیلتی آگ سے خطرے میں ہیں؟",
    STRANDED: "کیا کوئی شدید زخمی ہے یا گاڑی میں پھنسا ہوا ہے؟",
    SUPPLIES: "کیا کوئی خطرناک جگہ پھنسا ہوا ہے یا محفوظ مقام تک نہیں پہنچ سکتا؟",
    OTHER: "کیا کسی کی جان کو فوری خطرہ یا شدید چوٹ کا خدشہ ہے؟",
  },
  sd: {
    FLOOD: "ڇا ماڻهو ڦاٿل آهن يا وڌندڙ پاڻي کان فوري خطري ۾ آهن؟",
    MEDICAL: "ڇا ڪو بيهوش آهي، عام طرح ساهه نٿو کڻي، يا سندس جان کي فوري خطرو آهي؟",
    FIRE: "ڇا ماڻهو ڦاٿل، زخمي يا پکڙجندڙ باهه کان خطري ۾ آهن؟",
    STRANDED: "ڇا ڪو سخت زخمي آهي يا گاڏي ۾ ڦاٿل آهي؟",
    SUPPLIES: "ڇا ڪو خطرناڪ هنڌ ڦاٿل آهي يا محفوظ هنڌ تائين نٿو پهچي سگهي؟",
    OTHER: "ڇا ڪنهن جي جان کي فوري خطرو يا سخت زخمي ٿيڻ جو انديشو آهي؟",
  },
};

const emergencyOptions = [
  { value: "FLOOD" as const, icon: Waves, labels: { en: "Flood", ur: "سیلاب", sd: "ٻوڏ" } },
  { value: "MEDICAL" as const, icon: HeartPulse, labels: { en: "Medical Emergency", ur: "طبی ایمرجنسی", sd: "طبي ايمرجنسي" } },
  { value: "FIRE" as const, icon: Flame, labels: { en: "Fire", ur: "آگ", sd: "باهه" } },
  { value: "STRANDED" as const, icon: TriangleAlert, labels: { en: "Road Accident", ur: "سڑک حادثہ", sd: "روڊ حادثو" } },
  { value: "SUPPLIES" as const, icon: Navigation, labels: { en: "Stranded / Rescue Needed", ur: "پھنسے ہوئے / بچاؤ درکار", sd: "ڦاٿل / بچاءُ گهربل" } },
  { value: "OTHER" as const, icon: Siren, labels: { en: "Other", ur: "دیگر", sd: "ٻيو" } },
];

export function QuickSOSCorrected() {
  const [language, setLanguage] = useState<Language>(() => {
    if (typeof window === "undefined") return "en";
    const saved = sessionStorage.getItem("sos-language") as Language | null;
    return saved && words[saved] ? saved : "en";
  });

  const [screen, setScreen] = useState<Screen>("start");
  const [step, setStep] = useState<WizardStep>(1);
  const [direction, setDirection] = useState<"forward" | "backward">("forward");
  const [draft, setDraft] = useState<SOSDraft>({ ...emptyDraft });
  const [errors, setErrors] = useState<DraftErrors>({});
  const [mapOpen, setMapOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [reference, setReference] = useState("");
  const [copied, setCopied] = useState(false);
  const [failure, setFailure] = useState("");

  const advancing = useRef<NodeJS.Timeout | null>(null);
  const submitting = useRef(false);
  const activeStepHeadingRef = useRef<HTMLHeadingElement | null>(null);

  const t = words[language];

  // Clean up pending timeouts on unmount
  useEffect(() => {
    return () => {
      if (advancing.current) {
        clearTimeout(advancing.current);
      }
    };
  }, []);

  // Shift focus to step heading on step change for accessibility without unnecessary full page scrolling
  useEffect(() => {
    if (screen === "wizard" && activeStepHeadingRef.current) {
      activeStepHeadingRef.current.focus();
    }
  }, [step, screen]);

  const changeLanguage = (next: Language) => {
    sessionStorage.setItem("sos-language", next);
    setLanguage(next);
  };

  const update = (patch: Partial<SOSDraft>) => {
    setDraft((old) => ({ ...old, ...patch }));
    setErrors({});
    setFailure("");
  };

  // Step 1: Select Emergency Category -> brief feedback -> Auto-advance to Step 2
  const selectCategory = (cat: EmergencyType) => {
    if (advancing.current) {
      clearTimeout(advancing.current);
    }

    const isDifferent = cat !== draft.emergencyType;
    setDraft((old) => ({
      ...old,
      emergencyType: cat,
      // Reset danger response if category changed to keep context questions strictly compatible
      ...(isDifferent
        ? {
            safetyAnswer: "UNANSWERED" as const,
            safetyEmergencyType: "" as const,
            immediateDanger: "unknown" as const,
          }
        : {}),
    }));
    setErrors({});
    setFailure("");

    advancing.current = setTimeout(() => {
      setDirection("forward");
      setStep(2);
      advancing.current = null;
    }, 180);
  };

  // Step 2: Answer Danger Question -> brief feedback -> Auto-advance to Step 3
  const selectDanger = (answer: "YES" | "NO" | "UNSURE") => {
    if (advancing.current) {
      clearTimeout(advancing.current);
    }

    setDraft((old) => ({
      ...old,
      safetyAnswer: answer,
      safetyEmergencyType: old.emergencyType,
      immediateDanger: answer === "YES" ? "yes" : answer === "NO" ? "no" : "unknown",
    }));

    advancing.current = setTimeout(() => {
      setDirection("forward");
      setStep(3);
      advancing.current = null;
    }, 180);
  };

  const skipDanger = () => {
    if (advancing.current) {
      clearTimeout(advancing.current);
    }

    setDraft((old) => ({
      ...old,
      safetyAnswer: "UNANSWERED",
      safetyEmergencyType: old.emergencyType,
      immediateDanger: "unknown",
    }));

    setDirection("forward");
    setStep(3);
  };

  // Step 3: Location Handlers
  const locate = () => {
    if (!navigator.geolocation) {
      setLocationMessage(t.gpsDenied);
      return;
    }

    setLocating(true);
    setLocationMessage("");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        const lat = position.coords.latitude.toFixed(6);
        const lng = position.coords.longitude.toFixed(6);
        update({
          latitude: lat,
          longitude: lng,
          locationChoice: "gps",
        });
        setLocationMessage(t.locationCaptured);

        // Auto-advance to review on valid GPS acquisition
        if (advancing.current) clearTimeout(advancing.current);
        advancing.current = setTimeout(() => {
          setDirection("forward");
          setStep(4);
          advancing.current = null;
        }, 300);
      },
      () => {
        setLocating(false);
        setLocationMessage(t.gpsDenied);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  };

  const handleMapSelect = (point: { latitude: number; longitude: number }) => {
    update({
      latitude: String(point.latitude),
      longitude: String(point.longitude),
      locationChoice: "map",
    });
    setLocationMessage(t.locationOnMap);
    setMapOpen(false);

    // Auto-advance to review on confirmed map point
    if (advancing.current) clearTimeout(advancing.current);
    advancing.current = setTimeout(() => {
      setDirection("forward");
      setStep(4);
      advancing.current = null;
    }, 250);
  };

  const confirmLocation = () => {
    if (!selectedLocation(draft) && !draft.area.trim()) {
      setErrors({ area: t.noLocationError });
      return;
    }
    setDirection("forward");
    setStep(4);
  };

  // Step Navigation
  const canAccessStep = (targetStep: WizardStep): boolean => {
    if (targetStep === 1) return true;
    if (targetStep === 2) return !!draft.emergencyType;
    if (targetStep === 3) return !!draft.emergencyType;
    if (targetStep === 4)
      return !!draft.emergencyType && (!!selectedLocation(draft) || !!draft.area.trim());
    return false;
  };

  const goToStep = (targetStep: WizardStep) => {
    if (advancing.current) {
      clearTimeout(advancing.current);
      advancing.current = null;
    }
    if (!canAccessStep(targetStep)) return;
    setDirection(targetStep > step ? "forward" : "backward");
    setStep(targetStep);
  };

  const goBack = () => {
    if (advancing.current) {
      clearTimeout(advancing.current);
      advancing.current = null;
    }
    if (step > 1) {
      setDirection("backward");
      setStep((s) => (s - 1) as WizardStep);
    } else {
      setScreen("start");
    }
  };

  // Step 4: Submission
  const validForSubmit = () => {
    const next = { ...validateLocation(draft), ...validateDetails(draft) };
    if (!draft.emergencyType) next.emergencyType = t.step1Subtitle;
    if (!selectedLocation(draft) && !draft.area.trim()) next.area = t.noLocationError;
    setErrors(next);
    return !Object.keys(next).length;
  };

  const send = async () => {
    if (submitting.current) return;
    if (!validForSubmit()) {
      return;
    }

    submitting.current = true;
    setBusy(true);
    setFailure("");

    try {
      const incident = await incidents.create(toIncidentInput(draft));
      setReference(incident.reportReference || incident._id);
      setScreen("success");
    } catch {
      setFailure(t.submissionError);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  const reset = () => {
    setDraft({ ...emptyDraft });
    setReference("");
    setCopied(false);
    setStep(1);
    setScreen("start");
  };

  const copyReference = () => {
    if (reference) {
      void navigator.clipboard?.writeText(reference);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const progressSteps: { num: WizardStep; label: string }[] = [
    { num: 1, label: t.step1Label },
    { num: 2, label: t.step2Label },
    { num: 3, label: t.step3Label },
    { num: 4, label: t.step4Label },
  ];

  return (
    <div
      className="rqSosRoot rqQuickCorrected"
      dir={language === "en" ? "ltr" : "rtl"}
      lang={language === "sd" ? "sd" : language}
    >
      {/* Navigation Header */}
      <header className="rqSosNav">
        <Link href="/" className="rqSosHeaderLogo" aria-label="ResQLink home">
          <Image
            src="/images/ResQLink Shield Brand Logo.png"
            alt="ResQLink"
            width={2172}
            height={724}
            priority
          />
        </Link>
        <div className="rqSosLanguage" role="group" aria-label="Language selection">
          <button
            type="button"
            onClick={() => changeLanguage("en")}
            aria-pressed={language === "en"}
          >
            English
          </button>
          <button
            type="button"
            onClick={() => changeLanguage("ur")}
            aria-pressed={language === "ur"}
          >
            اردو
          </button>
          <button
            type="button"
            onClick={() => changeLanguage("sd")}
            aria-pressed={language === "sd"}
          >
            سنڌي
          </button>
        </div>
        <Link href="/">{t.portalBack}</Link>
      </header>

      {/* Main Layout */}
      <div className="rqSosLayout">
        <aside className="rqSosStory">
          <h2>{t.startNeed}</h2>
          <p>{t.startIntro}</p>
        </aside>

        <main className="rqSosPanel">
          <div className="rqSosAppHeader">
            <span className="rqSosOfficialBrand">
              <Image
                src="/images/ResQLink Shield Brand Logo.png"
                alt="ResQLink"
                width={2172}
                height={724}
              />
            </span>
          </div>

          <div className="rqSosAppContent">
            {/* SCREEN 1: Start Hero */}
            {screen === "start" && (
              <section className="rqQuickStart">
                <h1>{t.startNeed}</h1>
                <p>{t.startIntro}</p>
                <button
                  type="button"
                  className="rqSosEmergency"
                  onClick={() => {
                    setScreen("wizard");
                    setStep(1);
                  }}
                  aria-label="SOS"
                >
                  <Image
                    src="/images/Glowing Red SOS Emergency Button.png"
                    alt=""
                    width={1254}
                    height={1254}
                    priority
                  />
                </button>
                <strong>{t.startNoAccount}</strong>
                <p>{t.startTap}</p>
                <p className="rqSosPrototype">{t.prototypeNotice}</p>
              </section>
            )}

            {/* SCREEN 2: 4-Step Animated Wizard in One Unified Card */}
            {screen === "wizard" && (
              <div className="rqWizardContainer">
                {/* Header info */}
                <div className="rqWizardHeadingGroup">
                  <h1 className="rqWizardMainTitle">{t.wizardTitle}</h1>
                  <p className="rqWizardSubTitle">{t.wizardSubtitle}</p>
                </div>

                {/* Compact 4-Step Progress Indicator */}
                <nav
                  aria-label="Reporting progress"
                  className="rqWizardProgress"
                >
                  <ol className="rqProgressList">
                    {progressSteps.map((s, idx) => {
                      const isCompleted = step > s.num;
                      const isCurrent = step === s.num;
                      const isPending = step < s.num;
                      const isAccessible = isCompleted || (isPending && canAccessStep(s.num));

                      return (
                        <li
                          key={s.num}
                          className={`rqProgressItem ${
                            isCurrent
                              ? "current"
                              : isCompleted
                              ? "completed"
                              : "pending"
                          }`}
                          aria-current={isCurrent ? "step" : undefined}
                        >
                          <button
                            type="button"
                            disabled={!isAccessible}
                            onClick={() => goToStep(s.num)}
                            className="rqProgressBtn"
                            title={s.label}
                          >
                            <span className="rqStepBadge">
                              {isCompleted ? (
                                <Check size={14} strokeWidth={3} />
                              ) : (
                                s.num
                              )}
                            </span>
                            <span className="rqStepName">{s.label}</span>
                          </button>
                          {idx < progressSteps.length - 1 && (
                            <div
                              className={`rqProgressConnector ${
                                isCompleted ? "filled" : ""
                              }`}
                              aria-hidden="true"
                            />
                          )}
                        </li>
                      );
                    })}
                  </ol>
                </nav>

                {/* STEP 1: What happened? (Emergency Type) */}
                {step === 1 && (
                  <section
                    className="rqStepPane"
                    key="step-1"
                    aria-labelledby="step-1-title"
                  >
                    <div className="rqStepHeader">
                      <h2
                        id="step-1-title"
                        ref={activeStepHeadingRef}
                        tabIndex={-1}
                      >
                        {t.step1Title}
                      </h2>
                      <p>{t.step1Subtitle}</p>
                    </div>

                    <div className="rqEmergencyGrid" role="group" aria-label={t.step1Title}>
                      {emergencyOptions.map(({ value, icon: Icon, labels }) => {
                        const isSelected = draft.emergencyType === value;
                        return (
                          <button
                            type="button"
                            key={value}
                            className={`rqEmergencyCard ${
                              isSelected ? "selected" : ""
                            }`}
                            aria-pressed={isSelected}
                            onClick={() => selectCategory(value)}
                          >
                            <Icon size={36} />
                            <span className="rqEmergencyTitle">
                              {labels[language]}
                            </span>
                            {isSelected && (
                              <span className="rqSelectedBadge">
                                <Check size={13} strokeWidth={3} />
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {errors.emergencyType && (
                      <p role="alert" className="validation">
                        {errors.emergencyType}
                      </p>
                    )}

                    <div className="rqStepFooter">
                      <button
                        type="button"
                        onClick={goBack}
                        className="rqBackBtn"
                      >
                        <ArrowLeft size={16} />
                        {t.backAction}
                      </button>
                      {draft.emergencyType && (
                        <button
                          type="button"
                          onClick={() => goToStep(2)}
                          className="rqContinueBtn"
                        >
                          {t.step2Label}
                          <ArrowRight size={16} />
                        </button>
                      )}
                    </div>
                  </section>
                )}

                {/* STEP 2: Is anyone in immediate danger? (Safety Assessment) */}
                {step === 2 && draft.emergencyType && (
                  <section
                    className="rqStepPane"
                    key="step-2"
                    aria-labelledby="step-2-title"
                  >
                    <div className="rqStepHeader">
                      <div className="rqStepHeaderTop">
                        <h2
                          id="step-2-title"
                          ref={activeStepHeadingRef}
                          tabIndex={-1}
                        >
                          {t.step2Title}
                        </h2>
                        <span className="rqStepBadgePill">
                          {t.step2Optional}
                        </span>
                      </div>
                      <p className="rqContextQuestion">
                        {categoryDangerQuestions[language][draft.emergencyType]}
                      </p>
                      <small className="rqStepHelper">{t.step2Helper}</small>
                    </div>

                    <div
                      className="rqDangerCardList"
                      role="radiogroup"
                      aria-label={t.step2Title}
                    >
                      <button
                        type="button"
                        role="radio"
                        aria-label={t.dangerYes}
                        aria-checked={draft.safetyAnswer === "YES"}
                        className={`rqDangerCard danger-yes ${
                          draft.safetyAnswer === "YES" ? "selected" : ""
                        }`}
                        onClick={() => selectDanger("YES")}
                      >
                        <span className="rqDangerIcon">
                          <AlertTriangle size={20} />
                        </span>
                        <div className="rqDangerText">
                          <span className="rqDangerLabel">{t.dangerYes}</span>
                          <small className="rqDangerDesc">{t.dangerYesDesc}</small>
                        </div>
                        {draft.safetyAnswer === "YES" && (
                          <Check size={18} className="rqCheckIcon" />
                        )}
                      </button>

                      <button
                        type="button"
                        role="radio"
                        aria-label={t.dangerNo}
                        aria-checked={draft.safetyAnswer === "NO"}
                        className={`rqDangerCard danger-no ${
                          draft.safetyAnswer === "NO" ? "selected" : ""
                        }`}
                        onClick={() => selectDanger("NO")}
                      >
                        <span className="rqDangerIcon">
                          <ShieldCheck size={20} />
                        </span>
                        <div className="rqDangerText">
                          <span className="rqDangerLabel">{t.dangerNo}</span>
                          <small className="rqDangerDesc">{t.dangerNoDesc}</small>
                        </div>
                        {draft.safetyAnswer === "NO" && (
                          <Check size={18} className="rqCheckIcon" />
                        )}
                      </button>

                      <button
                        type="button"
                        role="radio"
                        aria-label={t.dangerUnsure}
                        aria-checked={draft.safetyAnswer === "UNSURE"}
                        className={`rqDangerCard danger-unsure ${
                          draft.safetyAnswer === "UNSURE" ? "selected" : ""
                        }`}
                        onClick={() => selectDanger("UNSURE")}
                      >
                        <span className="rqDangerIcon">
                          <HelpCircle size={20} />
                        </span>
                        <div className="rqDangerText">
                          <span className="rqDangerLabel">{t.dangerUnsure}</span>
                          <small className="rqDangerDesc">{t.dangerUnsureDesc}</small>
                        </div>
                        {draft.safetyAnswer === "UNSURE" && (
                          <Check size={18} className="rqCheckIcon" />
                        )}
                      </button>
                    </div>

                    <button
                      type="button"
                      className="rqSkipDangerBtn"
                      aria-label={t.dangerSkip}
                      onClick={skipDanger}
                    >
                      {t.dangerSkip} →
                    </button>

                    <div className="rqStepFooter">
                      <button
                        type="button"
                        onClick={goBack}
                        className="rqBackBtn"
                      >
                        <ArrowLeft size={16} />
                        {t.backAction}
                      </button>
                    </div>
                  </section>
                )}

                {/* STEP 3: Where is the emergency? (Location Selection) */}
                {step === 3 && (
                  <section
                    className="rqStepPane"
                    key="step-3"
                    aria-labelledby="step-3-title"
                  >
                    <div className="rqStepHeader">
                      <h2
                        id="step-3-title"
                        ref={activeStepHeadingRef}
                        tabIndex={-1}
                      >
                        {t.step3Title}
                      </h2>
                      <p>{t.step3Subtitle}</p>
                    </div>

                    {/* Show confirmed location pill if user already selected/returned */}
                    {(selectedLocation(draft) || draft.area.trim()) && (
                      <div className="rqConfirmedLocationBox" role="status">
                        <Check size={18} />
                        <span>
                          <strong>{t.confirmedLocation}:</strong>{" "}
                          {locationSummary(draft)}
                        </span>
                      </div>
                    )}

                    {/* Two Prominent Location Options */}
                    <div className="rqLocationButtons">
                      <button
                        type="button"
                        className="rqLocationBtn primary-gps"
                        onClick={locate}
                        disabled={locating}
                      >
                        <Navigation size={22} />
                        <span>{locating ? t.findingLocation : t.shareLocation}</span>
                      </button>

                      <button
                        type="button"
                        className="rqLocationBtn"
                        onClick={() => setMapOpen((prev) => !prev)}
                        aria-expanded={mapOpen}
                      >
                        <MapPinned size={22} />
                        <span>{t.chooseMap}</span>
                      </button>
                    </div>

                    {locationMessage && (
                      <p role="status" className="rqQuickMessage">
                        {locationMessage}
                      </p>
                    )}

                    {/* Map Picker Modal / Accordion */}
                    {mapOpen && (
                      <div className="rqMapPickerWrap">
                        <MapPicker
                          value={selectedLocation(draft)}
                          onSelect={handleMapSelect}
                        />
                      </div>
                    )}

                    {/* Landmark / Village Fallback */}
                    <label className="rqQuickLandmark">
                      <span>{t.orLandmark}</span>
                      <Input
                        value={draft.area}
                        maxLength={300}
                        placeholder={t.landmarkPlaceholder}
                        onChange={(event) =>
                          update({
                            area: event.target.value,
                            locationChoice: "manual",
                          })
                        }
                      />
                    </label>

                    {errors.area && (
                      <p role="alert" className="validation">
                        {errors.area}
                      </p>
                    )}

                    <div className="rqStepFooter">
                      <button
                        type="button"
                        onClick={goBack}
                        className="rqBackBtn"
                      >
                        <ArrowLeft size={16} />
                        {t.backAction}
                      </button>

                      {(selectedLocation(draft) || draft.area.trim()) && (
                        <button
                          type="button"
                          onClick={confirmLocation}
                          className="rqContinueBtn"
                        >
                          {t.confirmLocationContinue}
                          <ArrowRight size={16} />
                        </button>
                      )}
                    </div>
                  </section>
                )}

                {/* STEP 4: Review, Optional Details & Send */}
                {step === 4 && (
                  <section
                    className="rqStepPane"
                    key="step-4"
                    aria-labelledby="step-4-title"
                  >
                    <div className="rqStepHeader">
                      <h2
                        id="step-4-title"
                        ref={activeStepHeadingRef}
                        tabIndex={-1}
                      >
                        {t.step4Title}
                      </h2>
                      <p>{t.step4Subtitle}</p>
                    </div>

                    {/* Compact Summary Cards */}
                    <div className="rqReviewSummaryCard">
                      {/* Emergency Row */}
                      <div className="rqSummaryRow">
                        <span className="rqSummaryKey">
                          {t.summaryEmergency}
                        </span>
                        <span className="rqSummaryVal">
                          {
                            emergencyOptions.find(
                              (o) => o.value === draft.emergencyType,
                            )?.labels[language] || draft.emergencyType
                          }
                        </span>
                        <button
                          type="button"
                          className="rqChangeBtn"
                          onClick={() => goToStep(1)}
                        >
                          {t.changeAction}
                        </button>
                      </div>

                      {/* Danger Row */}
                      <div className="rqSummaryRow">
                        <span className="rqSummaryKey">
                          {t.summaryDanger}
                        </span>
                        <span className="rqSummaryVal">
                          {draft.safetyAnswer === "YES"
                            ? t.dangerReported
                            : draft.safetyAnswer === "NO"
                            ? t.dangerNone
                            : draft.safetyAnswer === "UNSURE"
                            ? t.dangerUnknown
                            : t.dangerUnanswered}
                        </span>
                        <button
                          type="button"
                          className="rqChangeBtn"
                          onClick={() => goToStep(2)}
                        >
                          {t.editAction}
                        </button>
                      </div>

                      {/* Location Row */}
                      <div className="rqSummaryRow">
                        <span className="rqSummaryKey">
                          {t.summaryLocation}
                        </span>
                        <span className="rqSummaryVal">
                          {locationSummary(draft)}
                        </span>
                        <button
                          type="button"
                          className="rqChangeBtn"
                          onClick={() => goToStep(3)}
                        >
                          {t.changeAction}
                        </button>
                      </div>
                    </div>

                    {/* Optional Details Collapsible */}
                    <details
                      className="rqQuickDetails"
                      open={detailsOpen}
                      onToggle={(event) =>
                        setDetailsOpen(
                          (event.target as HTMLDetailsElement).open,
                        )
                      }
                    >
                      <summary>
                        <ChevronDown size={18} />
                        <span>{t.summaryDetails}</span>
                      </summary>
                      <div>
                        <label>
                          {t.descLabel}
                          <Textarea
                            value={draft.description}
                            maxLength={2000}
                            placeholder="Provide any additional details that could assist rescue teams"
                            onChange={(event) =>
                              update({ description: event.target.value })
                            }
                          />
                        </label>
                        <label>
                          {t.nameLabel}
                          <Input
                            value={draft.reporterName}
                            maxLength={100}
                            placeholder="Optional"
                            onChange={(event) =>
                              update({ reporterName: event.target.value })
                            }
                          />
                        </label>
                        <label>
                          {t.peopleLabel}
                          <Input
                            type="number"
                            min={1}
                            max={10000}
                            value={draft.peopleAffected}
                            placeholder="Estimated number of affected individuals"
                            onChange={(event) =>
                              update({ peopleAffected: event.target.value })
                            }
                          />
                        </label>
                        {draft.emergencyType === "FLOOD" && (
                          <label>
                            {t.waterLabel}
                            <Select
                              value={draft.waterLevel}
                              onChange={(event) =>
                                update({
                                  waterLevel: event.target
                                    .value as SOSDraft["waterLevel"],
                                })
                              }
                            >
                              <option value="UNKNOWN">{t.waterUnknown}</option>
                              <option value="LOW">{t.waterLow}</option>
                              <option value="MODERATE">{t.waterModerate}</option>
                              <option value="HIGH">{t.waterHigh}</option>
                            </Select>
                          </label>
                        )}
                      </div>
                    </details>

                    {failure && (
                      <p role="alert" className="rqSosSubmissionError">
                        {failure}
                      </p>
                    )}

                    {/* Submit Action */}
                    <Button
                      className="rqSosPrimary rqQuickSend"
                      loading={busy}
                      loadingLabel={t.sendingSOS}
                      onClick={send}
                    >
                      {t.sendSOS}
                    </Button>

                    <div className="rqStepFooter">
                      <button
                        type="button"
                        onClick={goBack}
                        className="rqBackBtn"
                      >
                        <ArrowLeft size={16} />
                        {t.backAction}
                      </button>
                    </div>
                  </section>
                )}

                <p className="rqSosPrototype">{t.prototypeNotice}</p>
              </div>
            )}

            {/* SCREEN 3: Success Confirmation Screen with Public Reference */}
            {screen === "success" && (
              <section className="rqSosSuccess" aria-live="polite">
                <CheckCircle2 size={46} />
                <h1>{t.successTitle}</h1>
                <p>{t.successSaved}</p>
                <div>
                  <span>{t.refLabel}</span>
                  <strong>{reference}</strong>
                </div>
                <Button
                  variant="outline"
                  onClick={copyReference}
                >
                  {copied ? t.copiedRef : t.copyRef}
                </Button>
                <Button className="rqSosPrimary" onClick={reset}>
                  {t.anotherReport}
                </Button>
              </section>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
