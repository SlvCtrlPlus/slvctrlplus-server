import { EventEmitter } from 'events';

export default class EventEmitterFactory
{
    // eslint-disable-next-line @typescript-eslint/class-methods-use-this
    public create(): EventEmitter {
        return new EventEmitter();
    }
}
