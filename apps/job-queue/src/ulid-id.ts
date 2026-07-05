import { ulid } from "ulid";

export function newJobId(): string {
  return ulid();
}
