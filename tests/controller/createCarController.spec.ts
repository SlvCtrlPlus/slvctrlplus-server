import { Request, Response } from 'express';
import { mock } from 'jest-mock-extended';
import CreateCarController from '../../src/controller/createCarController';
import Car from '../../src/entity/car';
import UuidFactory from '../../src/factory/uuidFactory';
import CarRepository from '../../src/repository/carRepository';
import ClassToPlainSerializer from '../../src/serialization/classToPlainSerializer';
import PlainToClassSerializer from '../../src/serialization/plainToClassSerializer';
import { equals } from '../helper/matchers';

describe('createCarController', () => {

    it('it stores new car', async () => {

        const uuid = 'foo-bar-baz';
        const car = new Car(uuid, 'Aston Martin', 'Vengeance', null);
        const requestBody = {
            maker: 'Aston Martin',
            model: 'Vengeance'
        };

        const mockUuidFactory = mock<UuidFactory>();
        mockUuidFactory.create.calledWith().mockReturnValue(uuid);

        const mockPlainToClassSerializer = mock<PlainToClassSerializer>();
        mockPlainToClassSerializer.transform.calledWith(
            Car,
            equals({id: uuid, ...requestBody})
        ).mockReturnValue(car);

        const mockClassToPlainSerializer = mock<ClassToPlainSerializer>();
        mockClassToPlainSerializer.transform.calledWith(car).mockReturnValue(requestBody);

        const mockCarRepository = mock<CarRepository>();
        mockCarRepository.add.calledWith(car);

        const mockRequest = mock<Request>();
        mockRequest.body = requestBody;

        const mockResponse = mock<Response>();
        mockResponse.status.calledWith(201).mockReturnValue(mockResponse);
        mockResponse.json.calledWith(requestBody).mockReturnValue(mockResponse);

        const controller = new CreateCarController(
            mockCarRepository,
            mockPlainToClassSerializer,
            mockClassToPlainSerializer,
            mockUuidFactory
        );

        controller.execute(mockRequest, mockResponse);

        expect(mockUuidFactory.create).toHaveBeenCalledTimes(1);
        expect(mockCarRepository.add).toHaveBeenCalledTimes(1);
        expect(mockPlainToClassSerializer.transform).toHaveBeenCalledTimes(1);
    });
});
