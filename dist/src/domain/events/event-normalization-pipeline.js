export class EventNormalizationPipeline {
    registry;
    constructor(registry) {
        this.registry = registry;
    }
    normalize(rawEvent, context) {
        const strategy = this.registry.resolve(rawEvent);
        if (!strategy) {
            return null;
        }
        return strategy.normalize(rawEvent, context);
    }
}
