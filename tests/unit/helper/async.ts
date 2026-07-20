export async function waitTicks(ticks: number): Promise<void> {
    for (let i = 0; i < ticks; i++) {
        await Promise.resolve(); // a tick
    }
}
