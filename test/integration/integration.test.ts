
import { IsoBox } from '../../src/core/IsoBox';

describe('Integration Tests', () => {
    let isobox: IsoBox;

    beforeEach(() => {
        isobox = new IsoBox({
            memoryLimit: 128 * 1024 * 1024,
            cpuTimeLimit: 5000
        });
    });

    afterEach(async () => {
        await isobox.dispose();
    });

    describe('Standard JavaScript Execution', () => {
        it('should perform math operations', async () => {
            const result = await isobox.run('Math.sqrt(16) + Math.pow(2, 3)');
            expect(result).toBe(12);
        });

        it('should handle array manipulation', async () => {
            // Using JSON serialization to avoid transfer issues
            const result = await isobox.run(`
                const arr = [1, 2, 3];
                arr.push(4);
                JSON.stringify(arr.map(x => x * 2))
            `);
            expect(JSON.parse(result)).toEqual([2, 4, 6, 8]);
        });

        it('should handle string operations', async () => {
            const result = await isobox.run(`
                const str = "hello world";
                str.toUpperCase().split(" ").reverse().join(", ")
            `);
            expect(result).toBe("WORLD, HELLO");
        });

        it('should support dates', async () => {
            const result = await isobox.run(`
                new Date('2023-01-01').getFullYear()
            `);
            expect(result).toBe(2023);
        });

        it('should support object manipulation', async () => {
            const result = await isobox.run(`
                const obj = { a: 1, b: 2 };
                Object.entries(obj).reduce((acc, [k, v]) => acc + v, 0)
            `);
            expect(result).toBe(3);
        });
    });

    describe('Async Operations', () => {
        it('should handle async/await', async () => {
            const result = await isobox.run(`
                async function test() {
                    return await Promise.resolve(42);
                }
                test();
            `);
            expect(result).toBe(42);
        });
    });

    describe('Error Handling', () => {
        it('should return helpful error messages', async () => {
            try {
                await isobox.run('nonExistentVar');
            } catch (e) {
                expect((e as Error).message).toContain('ReferenceError');
                expect((e as Error).message).toContain('nonExistentVar');
            }
        });

        it('should catch thrown errors', async () => {
            try {
                await isobox.run('throw new Error("custom error")');
            } catch (e) {
                expect((e as Error).message).toContain('custom error');
            }
        });
    });
});
