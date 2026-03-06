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
  name: z.string().min(1).optional(),
  featureState: z.number().int().optional(),
  className: z.string().min(1).optional(),
  uid: z.string().min(1).optional()
});

const PersonsFileSchema = z.object({
  persons: z.array(RawPersonSchema).min(1)
});

export type MockPersonRecord = {
  userId: string;
  cardNo: string;
  citizenIdNo: string;
  cardName: string;
  userName: string;
  userType: string | null;
  userStatus: string | null;
  authority: string | null;
  validFrom: string | null;
  validTo: string | null;
  photosBase64: string[];
  photoUrls: string[];
};

const selectorMap: Record<string, (person: MockPersonRecord) => string> = {
  "accessuser.condition.userid": (person) => person.userId,
  "accessuser.condition.username": (person) => person.userName,
  "accessuser.condition.citizenidno": (person) => person.citizenIdNo,
  "accesscard.condition.userid": (person) => person.userId,
  "accesscard.condition.cardno": (person) => person.cardNo,
  "accesscard.condition.cardname": (person) => person.cardName
};

export class MockPersonStore {
  private readonly persons = new Map<string, MockPersonRecord>();

  constructor(personsFilePath = resolve(process.cwd(), "mock/persons.json")) {
    const raw = readFileSync(personsFilePath, "utf8");
    const parsed = PersonsFileSchema.parse(JSON.parse(raw));
    for (const [index, person] of parsed.persons.entries()) {
      const normalized = normalizePerson(person, index);
      this.persons.set(normalized.userId, normalized);
    }
  }

  pickRandom(random: () => number): MockPersonRecord {
    const all = this.all();
    const index = Math.floor(random() * all.length) % all.length;
    return all[index]!;
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
    return this.all()
      .filter((person) => resolver(person) === input.value)
      .slice(0, input.limit);
  }

  list(input: { offset: number; limit: number }): MockPersonRecord[] {
    const offset = Math.max(0, input.offset);
    const limit = Math.max(0, input.limit);
    return this.all().slice(offset, offset + limit);
  }

  getByUserId(userId: string): MockPersonRecord | null {
    return this.persons.get(userId) ?? null;
  }

  upsertUser(input: {
    userId: string;
    userName: string;
    userType?: string | null;
    userStatus?: string | null;
    authority?: string | null;
    citizenIdNo?: string | null;
    validFrom?: string | null;
    validTo?: string | null;
  }): void {
    const current = this.persons.get(input.userId) ?? createEmptyPerson(input.userId);
    this.persons.set(input.userId, {
      ...current,
      userId: input.userId,
      userName: input.userName,
      cardName: current.cardName || input.userName,
      userType: input.userType ?? current.userType,
      userStatus: input.userStatus ?? current.userStatus,
      authority: input.authority ?? current.authority,
      citizenIdNo: input.citizenIdNo ?? current.citizenIdNo,
      validFrom: input.validFrom ?? current.validFrom,
      validTo: input.validTo ?? current.validTo
    });
  }

  upsertCard(input: {
    userId: string;
    cardNo: string;
    cardName?: string | null;
  }): void {
    const current = this.persons.get(input.userId) ?? createEmptyPerson(input.userId);
    this.persons.set(input.userId, {
      ...current,
      userId: input.userId,
      cardNo: input.cardNo,
      cardName: input.cardName ?? current.cardName,
      userName: current.userName || input.cardName || current.cardName
    });
  }

  upsertFace(input: {
    userId: string;
    photosBase64?: string[];
    photoUrls?: string[];
  }): void {
    const current = this.persons.get(input.userId) ?? createEmptyPerson(input.userId);
    this.persons.set(input.userId, {
      ...current,
      photosBase64: input.photosBase64?.length ? [...input.photosBase64] : current.photosBase64,
      photoUrls: input.photoUrls?.length ? [...input.photoUrls] : current.photoUrls
    });
  }

  private all(): MockPersonRecord[] {
    return [...this.persons.values()];
  }
}

function normalizePerson(person: z.infer<typeof RawPersonSchema>, index: number): MockPersonRecord {
  const userId = person.userId ?? person.terminalPersonId ?? String(index + 1);
  const cardNo = person.cardNo ?? person.id ?? `CARD-${index + 1}`;
  const citizenIdNo = person.citizenIdNo ?? person.id ?? cardNo;
  const userName = person.userName ?? person.name ?? `Person ${index + 1}`;
  const cardName = person.cardName ?? userName;
  return {
    userId,
    cardNo,
    citizenIdNo,
    cardName,
    userName,
    userType: person.className ?? null,
    userStatus: person.featureState === undefined ? null : String(person.featureState),
    authority: null,
    validFrom: null,
    validTo: null,
    photosBase64: [],
    photoUrls: person.uid ? [`mock://${person.uid}`] : []
  };
}

function createEmptyPerson(userId: string): MockPersonRecord {
  return {
    userId,
    cardNo: `CARD-${userId}`,
    citizenIdNo: userId,
    cardName: userId,
    userName: userId,
    userType: null,
    userStatus: null,
    authority: null,
    validFrom: null,
    validTo: null,
    photosBase64: [],
    photoUrls: []
  };
}
