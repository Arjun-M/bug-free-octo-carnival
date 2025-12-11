
import { StreamBuffer } from '../../src/streaming/StreamBuffer';

describe('StreamBuffer', () => {
    let buffer: StreamBuffer<string>;

    beforeEach(() => {
        buffer = new StreamBuffer();
    });

    it('should push and shift data', () => {
        buffer.push('hello');
        expect(buffer.shift()).toBe('hello');
    });

    it('should handle multiple pushes', () => {
        buffer.push('hello');
        buffer.push(' ');
        buffer.push('world');
        expect(buffer.shift()).toBe('hello');
        expect(buffer.shift()).toBe(' ');
        expect(buffer.shift()).toBe('world');
    });

    it('should return undefined if empty', () => {
        expect(buffer.shift()).toBeUndefined();
        expect(buffer.isEmpty()).toBe(true);
    });

    it('should clear buffer', () => {
        buffer.push('test');
        buffer.clear();
        expect(buffer.shift()).toBeUndefined();
        expect(buffer.isEmpty()).toBe(true);
    });

    it('should handle backpressure', () => {
        // High watermark default is 800
        const smallBuffer = new StreamBuffer({ highWaterMark: 2 });
        expect(smallBuffer.push('1')).toBe(true);
        expect(smallBuffer.push('2')).toBe(false); // Paused
        expect(smallBuffer.isPausedState()).toBe(true);
    });
});
