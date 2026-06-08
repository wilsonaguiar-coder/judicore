import { NextResponse } from "next/server";

export async function GET() {
  try {
    const dynamicImport = new Function('modulePath', 'return import(modulePath)');
    const pdfParseModule = await dynamicImport('pdf-parse');
    
    return NextResponse.json({
      typeOfModule: typeof pdfParseModule,
      keys: Object.keys(pdfParseModule),
      hasDefault: !!pdfParseModule.default,
      typeOfDefault: typeof pdfParseModule.default,
      defaultKeys: pdfParseModule.default ? Object.keys(pdfParseModule.default) : []
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message });
  }
}
