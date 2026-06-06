import type { AssistedRevisionRequest, AssistedRevisionSuggestion } from "./assisted-revision.types.js";

export interface LLMRevisionAdapter {
  suggestRevision(request: AssistedRevisionRequest): Promise<AssistedRevisionSuggestion>;
}
