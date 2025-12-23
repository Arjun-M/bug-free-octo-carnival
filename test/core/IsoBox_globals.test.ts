
import { IsoBox } from '../../src/core/IsoBox';

describe('IsoBox Globals Injection', () => {
    let box: IsoBox;

    afterEach(async () => {
        if (box) await box.dispose();
    });

    it('should inject empty object', async () => {
        box = new IsoBox({
            sandbox: { emptyObj: {} }
        });
        const result = await box.run('typeof emptyObj');
        expect(result).toBe('object');

        const presence = await box.run('typeof emptyObj !== "undefined"');
        expect(presence).toBe(true);

        const keys = await box.run('Object.keys(emptyObj).length');
        expect(keys).toBe(0);
    });

    it('should inject pure data object', async () => {
        box = new IsoBox({
            sandbox: {
                data: { a: 1 }
            }
        });
        const result = await box.run('data.a');
        expect(result).toBe(1);
    });
});
