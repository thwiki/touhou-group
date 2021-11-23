export interface ParseResult {
  parse: Parse;
}

export interface Parse {
  title: string;
  pageid: number;
  revid: number;
  text?: Text;
  limitreportdata: LimitReportData[];
}

export interface LimitReportData {
  [index: number]: number | string;
  name: LimitReportDataName;
}

export type LimitReportDataName =
  | "smw-limitreport-intext-parsertime"
  | "limitreport-cputime"
  | "limitreport-walltime"
  | "limitreport-ppvisitednodes"
  | "limitreport-ppgeneratednodes"
  | "limitreport-postexpandincludesize"
  | "limitreport-templateargumentsize"
  | "limitreport-expansiondepth"
  | "limitreport-expensivefunctioncount"
  | "limitreport-unstrip-depth"
  | "limitreport-unstrip-size"
  | "limitreport-timingprofile"
  | "cachereport-timestamp"
  | "cachereport-ttl"
  | "cachereport-transientcontent";

export interface Text {
  "*"?: string;
}

export interface ErrorResult {
  error: Error;
}

export interface Error {
  code: string;
  info: string;
  "*"?: string;
}

export type Result = ParseResult | ErrorResult;
