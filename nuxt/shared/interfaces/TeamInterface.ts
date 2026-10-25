// Read-only projection of Team from the existing domain diagram; no ORM or audit fields are needed.
export interface TeamInterface {
  readonly country: string;
  readonly foundedDate: string;
  readonly id: string;
  readonly name: string;
  readonly stadium: string;
}
