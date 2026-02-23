const ACCESS_USER_SELECTORS = [
    "accessUser.Condition.UserID",
    "accessUser.Condition.UserName",
    "accessUser.Condition.CitizenIDNo"
];
const ACCESS_CARD_SELECTORS = [
    "accessCard.Condition.UserID",
    "accessCard.Condition.CardNo",
    "accessCard.Condition.CardName"
];
export class MockDahuaClient {
    options;
    constructor(options) {
        this.options = options;
    }
    async connect() {
        return;
    }
    async close() {
        return;
    }
    async findAccessUsers(input) {
        if (Object.keys(input.condition).length === 0) {
            return this.options.personStore.list({
                offset: input.offset ?? 0,
                limit: input.limit
            }).map((person) => ({
                UserID: person.userId,
                UserName: person.cardName,
                UserType: "0",
                CitizenIDNo: person.citizenIdNo
            }));
        }
        const criteria = resolveSearchCriteria(input.condition, ACCESS_USER_SELECTORS);
        if (!criteria) {
            return [];
        }
        const matched = this.options.personStore.search({
            selector: criteria.selector,
            value: criteria.value,
            limit: input.limit
        });
        return matched.map((person) => ({
            UserID: person.userId,
            UserName: person.cardName,
            CitizenIDNo: person.citizenIdNo
        }));
    }
    async findAccessCards(input) {
        if (Object.keys(input.condition).length === 0) {
            return this.options.personStore.list({
                offset: input.offset ?? 0,
                limit: input.limit
            }).map((person) => ({
                UserID: person.userId,
                CardNo: person.cardNo,
                CardName: person.cardName
            }));
        }
        const criteria = resolveSearchCriteria(input.condition, ACCESS_CARD_SELECTORS);
        if (!criteria) {
            return [];
        }
        const matched = this.options.personStore.search({
            selector: criteria.selector,
            value: criteria.value,
            limit: input.limit
        });
        return matched.map((person) => ({
            UserID: person.userId,
            CardNo: person.cardNo,
            CardName: person.cardName
        }));
    }
    async findAccessControlRecords(_input) {
        return [];
    }
    makeMockAccessControlData(nowMs) {
        const person = this.options.personStore.pickRandom(Math.random);
        return {
            recNo: Math.floor(nowMs / 1000),
            utcSec: Math.floor(nowMs / 1000),
            userId: person.userId,
            cardNo: person.cardNo,
            method: 1,
            type: "Entry"
        };
    }
}
function resolveSearchCriteria(condition, selectors) {
    for (const selector of selectors) {
        const field = selector.split(".").slice(2).join(".");
        const value = condition[field];
        if (value !== undefined && value !== "") {
            return {
                selector,
                value
            };
        }
    }
    return null;
}
