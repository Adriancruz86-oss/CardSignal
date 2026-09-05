"use client";

import {useEffect} from "react";
import {LONGITUDINAL_SCAN_KEY,mergeLongitudinalFromCards,readLongitudinalScanHistory,type ScanSourceCard} from "./longitudinal-scan-history";
const CARD_KEY="cardsignal-added-cards";
function readCards():ScanSourceCard[]{try{const v=JSON.parse(localStorage.getItem(CARD_KEY)||"[]");return Array.isArray(v)?v:[]}catch{return[]}}
export default function LongitudinalScanHistoryLayer(){useEffect(()=>{const capture=()=>{const next=mergeLongitudinalFromCards(readLongitudinalScanHistory(),readCards());if(!next.changed)return;try{localStorage.setItem(LONGITUDINAL_SCAN_KEY,JSON.stringify(next.rows));window.dispatchEvent(new Event("cardsignal:longitudinal-history-changed"));}catch{}};capture();window.addEventListener("cardsignal:user-cards-changed",capture);window.addEventListener("cardsignal:cloud-restored",capture);return()=>{window.removeEventListener("cardsignal:user-cards-changed",capture);window.removeEventListener("cardsignal:cloud-restored",capture)}},[]);return null}
