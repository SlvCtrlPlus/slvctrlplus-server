import Car from '../../src/entity/car';
import CarRepository from '../../src/repository/carRepository';

describe('car repository', () => {
    it('has no entries by default', async () => {
        const carRepository = new CarRepository();

        expect(carRepository.getAll().length).toBe(0);
    });

    it('stores entry', async () => {
        const carRepository = new CarRepository();
        const car = new Car('my-uuid', 'Aston Martin', 'Vengeance', null);

        expect(carRepository.getAll().length).toBe(0);

        carRepository.add(car);

        const allCars = carRepository.getAll();

        expect(allCars.length).toBe(1);
        expect(allCars[0]).toBe(car);
    });
});
