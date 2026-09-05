import {combineScanHistories,readLongitudinalScanHistory} from "./longitudinal-scan-history";
import type {ScanSnapshot} from "./catalyst-outcome-model";

const SHORT_KEY="cardsignal-scan-history";
export function readValidationScanHistory():ScanSnapshot[]{if(typeof window==="undefined")return[];let short:ScanSnapshot[]=[];try{const v=JSON.parse(localStorage.getItem(SHORT_KEY)||"[]");short=Array.isArray(v)?v:[]}catch{}return combineScanHistories(short,readLongitudinalScanHistory()) as ScanSnapshot[]}
