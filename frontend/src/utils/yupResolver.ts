import { FormErrors } from "@mantine/form";
import { ValidationError } from "yup";

export function yupResolver(
  schema: {
    validateSync: (
      values: Record<string, unknown>,
      options?: { abortEarly?: boolean },
    ) => unknown;
  },
): (values: Record<string, unknown>) => FormErrors {
  return (values: Record<string, unknown>) => {
    try {
      schema.validateSync(values, { abortEarly: false });
      return {};
    } catch (yupError) {
      if (yupError instanceof ValidationError) {
        const results: FormErrors = {};
        yupError.inner.forEach((error) => {
          if (error.path) {
            results[error.path] = error.message;
          }
        });
        return results;
      }
      return {};
    }
  };
}
