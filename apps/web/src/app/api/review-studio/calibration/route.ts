import { NextResponse } from "next/server";
import { StrengthReviewTelemetryService, StrengthReviewerCalibrationService } from "@judicore/ai";

export async function GET() {
  try {
    const telemetry = new StrengthReviewTelemetryService();
    const calibration = new StrengthReviewerCalibrationService(telemetry);
    const report = calibration.calibrate();
    return NextResponse.json(report);
  } catch (err) {
    console.error("[calibration] Erro ao gerar relatório:", err);
    return NextResponse.json({ error: "Erro interno ao gerar calibração." }, { status: 500 });
  }
}
