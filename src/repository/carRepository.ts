import Car from "../entity/car.js";

export default class CarRepository
{
    private cars: Car[] = [];

    public add(car: Car): void
    {
        this.cars.push(car);
    }

    public getAll(): Car[]
    {
        return this.cars;
    }
}
