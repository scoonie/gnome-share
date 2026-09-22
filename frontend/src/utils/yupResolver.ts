import { FormErrors } from "@mantine/form";
import { AnyObject, ObjectSchema, ValidationError } from "yup";

export function yupResolver<TValues extends AnyObject | undefined>(
  schema: ObjectSchema<TValues, AnyObject, any, any>,
): (values: Record<string, unknown>) => FormErrors {
  return (values: Record<string, unknown>) => {
    try {
      schema.validateSync(values as TValues, { abortEarly: false });
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
