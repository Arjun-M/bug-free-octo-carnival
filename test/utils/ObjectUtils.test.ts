
import * as ObjectUtils from '../../src/utils/ObjectUtils';

describe('ObjectUtils', () => {
    it('should copy value deeply', () => {
        const obj = { a: 1, b: { c: 2 } };
        const copy = ObjectUtils.copyValue(obj);
        expect(copy).toEqual(obj);
        expect(copy).not.toBe(obj);
        expect(copy.b).not.toBe(obj.b);
    });

    it('should handle circular references', () => {
        const obj: any = { a: 1 };
        obj.self = obj;
        const copy = ObjectUtils.copyValue(obj);
        expect(copy.a).toBe(1);
        expect(copy.self).toBe('[Circular]');
    });

    it('should check transferability', () => {
        expect(ObjectUtils.isTransferable({ a: 1 })).toBe(true);
        const circular: any = {};
        circular.self = circular;
        expect(ObjectUtils.isTransferable(circular)).toBe(false);
    });
});
