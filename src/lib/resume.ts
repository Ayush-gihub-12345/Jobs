export async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  let text = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((it: any) => it.str ?? "").join(" ") + "\n";
  }
  return text;
}

export async function readResumeFile(file: File): Promise<string> {
  const text = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
    ? await extractPdfText(file)
    : await file.text();
  if (text.trim().length < 30) {
    throw new Error("Couldn't read enough text from this file. If it's a scanned PDF, paste your resume text instead.");
  }
  return text;
}
