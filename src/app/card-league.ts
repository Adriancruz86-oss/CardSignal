export type CardLeague="MLB"|"NBA"|"WNBA"|"NFL"|"NHL"|"MLS"|"NWSL"|"COLLEGE"|"OTHER"|"UNKNOWN";

export type LeagueCard={player?:string;meta?:string;setName?:string;variant?:string;sport?:string;league?:string};

function norm(v:unknown){return String(v||"").toLowerCase();}

const EXPLICIT:CardLeague[]=["MLB","NBA","WNBA","NFL","NHL","MLS","NWSL","COLLEGE","OTHER","UNKNOWN"];
const RULES:Array<[CardLeague,string[]]>=[
 ["WNBA",["wnba","women's basketball","womens basketball"]],
 ["NBA",["nba","basketball","prizm basketball","hoops basketball","select basketball","optic basketball"]],
 ["MLB",["mlb","baseball","topps baseball","bowman baseball","baseball chrome","stadium club baseball"]],
 ["NFL",["nfl","football","prizm football","select football","optic football","donruss football"]],
 ["NHL",["nhl","hockey","upper deck hockey","young guns hockey"]],
 ["MLS",["mls","major league soccer"]],
 ["NWSL",["nwsl","women's soccer","womens soccer"]],
 ["COLLEGE",["ncaa","college","collegiate","draft picks"]],
];

export function getCardLeague(card:LeagueCard):CardLeague{
 const explicit=String(card.league||card.sport||"").trim().toUpperCase();
 if(EXPLICIT.includes(explicit as CardLeague))return explicit as CardLeague;
 const t=norm([card.sport,card.league,card.meta,card.setName,card.variant].filter(Boolean).join(" "));
 for(const [league,keys] of RULES)if(keys.some(k=>t.includes(k)))return league;
 return "UNKNOWN";
}

export const CARD_LEAGUES:CardLeague[]=["MLB","NBA","WNBA","NFL","NHL","MLS","NWSL","COLLEGE","OTHER","UNKNOWN"];
