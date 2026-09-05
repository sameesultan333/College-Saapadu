import { apiGet, apiFetch } from "../../services/apiClient";

export interface ReportLine {
  name: string;
  quantity: number;
  unit_price: number;
  gst_rate: number;
  gross_amount: number;
  taxable_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  total_gst_amount: number;
}

export interface ReportTransaction {
  order_id: number;
  time: string;
  customer: string;
  guest_code: string | null;
  payment_mode: string;
  order_type: string;
  status: string;
  items: ReportLine[];
  gross_amount: number;
  taxable_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  total_gst_amount: number;
}

export interface ItemSummaryRow {
  menu_item_id: number;
  name: string;
  gst_rate: number;
  quantity: number;
  gross_amount: number;
  taxable_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  total_gst_amount: number;
}

export interface DailyReport {
  college: { id: number; name: string };
  canteen: { id: number; name: string };
  report_date: string;
  generated_at: string;
  transactions: ReportTransaction[];
  item_summary: ItemSummaryRow[];
  payment_summary: { payment_mode: string; order_count: number; gross_amount: number }[];
  gst_summary: {
    gst_rate: number;
    gross_amount: number;
    taxable_amount: number;
    cgst_amount: number;
    sgst_amount: number;
    total_gst_amount: number;
  }[];
  totals: {
    order_count: number;
    item_count: number;
    gross_sales: number;
    taxable_sales: number;
    cgst_amount: number;
    sgst_amount: number;
    total_gst: number;
  };
  excluded_orders: unknown[];
  contains_estimated_values: boolean;
}

export interface CanteenSection {
  canteen: { id: number; name: string };
  totals: DailyReport["totals"];
  item_summary: ItemSummaryRow[];
  payment_summary: DailyReport["payment_summary"];
  gst_summary: DailyReport["gst_summary"];
  transactions: ReportTransaction[];
}

export interface CollegeReport {
  college: { id: number; name: string };
  scope: "college";
  report_date: string;
  generated_at: string;
  canteens: CanteenSection[];
  combined_item_summary: ItemSummaryRow[];
  combined_payment_summary: DailyReport["payment_summary"];
  combined_gst_summary: DailyReport["gst_summary"];
  grand_totals: DailyReport["totals"];
  excluded_orders: unknown[];
  contains_estimated_values: boolean;
}

export function fetchDailyReport(canteenId: number, reportDate: string): Promise<DailyReport> {
  return apiGet(`/reports/daily?canteen_id=${canteenId}&report_date=${reportDate}`);
}

export function fetchCollegeReport(reportDate: string): Promise<CollegeReport> {
  return apiGet(`/reports/daily/college?report_date=${reportDate}`);
}

export function downloadCollegeReportPdf(reportDate: string) {
  return downloadReport(
    `/reports/daily/college/pdf?report_date=${reportDate}`,
    `sales-gst-report-all-canteens-${reportDate}.pdf`
  );
}

export function downloadCollegeReportExcel(reportDate: string) {
  return downloadReport(
    `/reports/daily/college/excel?report_date=${reportDate}`,
    `sales-gst-report-all-canteens-${reportDate}.xlsx`
  );
}

// The export endpoints are authenticated, so the file is fetched with the
// bearer token attached and then handed to the browser as a blob -- a plain
// <a href> would hit them unauthenticated.
async function downloadReport(path: string, filename: string) {
  const res = await apiFetch(path);
  if (!res.ok) {
    throw new Error("Download failed");
  }

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export function downloadReportPdf(canteenId: number, canteenName: string, reportDate: string) {
  return downloadReport(
    `/reports/daily/pdf?canteen_id=${canteenId}&report_date=${reportDate}`,
    `sales-gst-report-${canteenName.replace(/\s+/g, "_")}-${reportDate}.pdf`
  );
}

export function downloadReportExcel(canteenId: number, canteenName: string, reportDate: string) {
  return downloadReport(
    `/reports/daily/excel?canteen_id=${canteenId}&report_date=${reportDate}`,
    `sales-gst-report-${canteenName.replace(/\s+/g, "_")}-${reportDate}.xlsx`
  );
}
