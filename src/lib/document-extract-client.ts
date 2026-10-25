export interface ExtractDraftField {
  kind: string;
  value: string;
  unit: string;
}

export interface ExtractClientResult {
  fields: ExtractDraftField[];
  note: string;
  extractStatus: "needs_review" | "not_extracted" | "failed";
  provider: string;
}

export function applyExtractResponse(data: {
  status?: string;
  error?: string;
  fields?: { kind?: string; value?: string; unit?: string; systolic?: number; diastolic?: number }[];
  proposal?: { measurements?: { kind?: string; value?: string; unit?: string | null }[] } | null;
  extractedText?: string;
  provider?: string;
}): ExtractClientResult {
  const provider = data.provider || "none";
  const fromFields = (data.fields ?? []).filter((f) => f.kind && f.value).map((f) => ({
    kind: String(f.kind),
    value: f.systolic != null && f.diastolic != null ? `${f.systolic}/${f.diastolic}` : String(f.value),
    unit: f.unit ? String(f.unit) : "",
  }));
  const fromProposal = (data.proposal?.measurements ?? []).filter((f) => f.kind && f.value).map((f) => ({
    kind: String(f.kind),
    value: String(f.value),
    unit: f.unit ? String(f.unit) : "",
  }));
  const fields = fromFields.length ? fromFields : fromProposal;

  if (data.status === "needs_review") {
    return {
      fields,
      extractStatus: "needs_review",
      provider,
      note: fields.length
        ? "Values below came from the file and still need your review. They are not saved as health readings yet."
        : "Text was read from the file. Confirm the details below. Nothing was saved as a measurement yet.",
    };
  }
  if (data.status === "not_extracted") {
    return {
      fields: [],
      extractStatus: "not_extracted",
      provider,
      note: data.error || "This scan could not be read. The file is still saved. Scan reading needs the server extraction key.",
    };
  }
  return {
    fields: [],
    extractStatus: "failed",
    provider,
    note: data.error || "Extraction failed. The original file is unchanged.",
  };
}
