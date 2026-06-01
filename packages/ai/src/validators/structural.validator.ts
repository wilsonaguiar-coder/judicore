import type { TipoPeca, ValidationError, ValidationResult } from "../pipeline/types.js";
import { STRUCTURAL_REQUIREMENTS } from "../rules/legal_rules.js";

export class StructuralValidator {
  validate(draft: string, tipoPeca: TipoPeca): ValidationResult {
    const errors: ValidationError[] = [];
    const reqs = STRUCTURAL_REQUIREMENTS[tipoPeca];
    if (!reqs) return { valid: true, errors: [] };

    for (const req of reqs.required_text_patterns) {
      if (!req.pattern.test(draft)) {
        errors.push({ rule: "MISSING_STRUCTURE", message: `${tipoPeca} deve conter: ${req.label}`, fatal: req.fatal });
      }
    }
    for (const req of reqs.required_structural_patterns) {
      if (!req.pattern.test(draft)) {
        errors.push({ rule: "MISSING_STRUCTURE", message: `${tipoPeca} deve conter: ${req.label}`, fatal: req.fatal });
      }
    }
    for (const forbidden of reqs.forbidden_patterns) {
      if (forbidden.pattern.test(draft)) {
        errors.push({ rule: "FORBIDDEN_STRUCTURE", message: forbidden.label, fatal: forbidden.fatal });
      }
    }

    return { valid: !errors.some((e) => e.fatal), errors };
  }
}
