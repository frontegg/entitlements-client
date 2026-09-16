import { InvalidObjectTypeException } from '../exceptions/invalid-object-type.exception';

export function isInputError(err: unknown): err is InvalidObjectTypeException {
	return err instanceof InvalidObjectTypeException;
}
