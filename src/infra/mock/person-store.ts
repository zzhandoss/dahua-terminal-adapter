import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";

const RawPersonSchema = z.object({
  userId: z.string().min(1).optional(),
  cardNo: z.string().min(1).optional(),
  citizenIdNo: z.string().min(1).optional(),
  cardName: z.string().min(1).optional(),
  userName: z.string().min(1).optional(),
  terminalPersonId: z.string().min(1).optional(),
  id: z.string().min(1).optional(),
  name: z.string().min(1).optional()
});

const PersonsFileSchema = z.object({
  persons: z.array(RawPersonSchema).min(1)
});

export type MockPersonRecord = {
  userId: string;
  cardNo: string;
  citizenIdNo: string;
  cardName: string;
};

const selectorMap: Record<string, (person: MockPersonRecord) => string> = {
  "accessuser.condition.userid": (person) => person.userId,
  "accessuser.condition.username": (person) => person.cardName,
  "accessuser.condition.citizenidno": (person) => person.citizenIdNo,
  "accesscard.condition.userid": (person) => person.userId,
  "accesscard.condition.cardno": (person) => person.cardNo,
  "accesscard.condition.cardname": (person) => person.cardName
};

export class MockPersonStore {
  private readonly persons: MockPersonRecord[];

  constructor(personsFilePath = resolve(process.cwd(), "mock/persons.json")) {
    const raw = readFileSync(personsFilePath, "utf8");
    const parsed = PersonsFileSchema.parse(JSON.parse(raw));
    this.persons = parsed.persons.map((person, index) => normalizePerson(person, index));
  }

  pickRandom(random: () => number): MockPersonRecord {
    const index = Math.floor(random() * this.persons.length) % this.persons.length;
    return this.persons[index]!;
  }

  search(input: {
    selector: string;
    value: string;
    limit: number;
  }): MockPersonRecord[] {
    const resolver = selectorMap[input.selector.toLowerCase()];
    if (!resolver) {
      return [];
    }
    return this.persons
      .filter((person) => resolver(person) === input.value)
      .slice(0, input.limit);
  }

  list(input: { offset: number; limit: number }): MockPersonRecord[] {
    const offset = Math.max(0, input.offset);
    const limit = Math.max(0, input.limit);
    return this.persons.slice(offset, offset + limit);
  }
}

function normalizePerson(person: z.infer<typeof RawPersonSchema>, index: number): MockPersonRecord {
  const userId = person.userId ?? person.terminalPersonId ?? String(index + 1);
  const cardNo = person.cardNo ?? person.id ?? `CARD-${index + 1}`;
  const citizenIdNo = person.citizenIdNo ?? person.id ?? cardNo;
  const cardName = person.cardName ?? person.userName ?? person.name ?? `Person ${index + 1}`;
  return { userId, cardNo, citizenIdNo, cardName };
}
