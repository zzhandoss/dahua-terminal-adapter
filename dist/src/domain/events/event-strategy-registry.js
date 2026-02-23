export class EventStrategyRegistry {
    strategies;
    constructor(strategies) {
        this.strategies = strategies;
    }
    resolve(event) {
        for (const strategy of this.strategies) {
            if (strategy.supports(event)) {
                return strategy;
            }
        }
        return null;
    }
}
