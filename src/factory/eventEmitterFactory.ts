import { EventEmitter } from 'events';

export default class EventEmitterFactory
{
    public create(): EventEmitter {
        return new EventEmitter();
    }
}
