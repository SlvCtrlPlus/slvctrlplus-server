import { Request, Response } from 'express';
import Car from '../entity/car.js';
import CarRepository from '../repository/carRepository.js';
import ControllerInterface from './controllerInterface.js';
import PlainToClassSerializer from '../serialization/plainToClassSerializer.js';
import ClassToPlainSerializer from '../serialization/classToPlainSerializer.js';
import UuidFactory from '../factory/uuidFactory.js';

export default class CreateCarController implements ControllerInterface
{
    private carRepository: CarRepository;

    private plainToClassSerializer: PlainToClassSerializer;

    private classToPlainSerializer: ClassToPlainSerializer;

    private uuidFactory: UuidFactory;

    public constructor(
        carRepository: CarRepository,
        plainToClassSerializer: PlainToClassSerializer,
        classToPlainSerializer: ClassToPlainSerializer,
        uuidFactory: UuidFactory
    ) {
        this.carRepository = carRepository;
        this.plainToClassSerializer = plainToClassSerializer;
        this.classToPlainSerializer = classToPlainSerializer;
        this.uuidFactory = uuidFactory;
    }

    public execute(req: Request, res: Response): void
    {
        console.log(req.body);

        const car = this.plainToClassSerializer.transform(Car, {
            id: this.uuidFactory.create(),
            ...req.body
        });

        console.log(car);

        this.carRepository.add(car);

        console.log(`Added car ${car.getMaker()} ${car.getModel()} to the list`);

        res.status(201).json(this.classToPlainSerializer.transform(car));
    }
}
