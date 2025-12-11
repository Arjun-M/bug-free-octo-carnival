
import { ProjectLoader } from '../../src/project/ProjectLoader';
import { MemFS } from '../../src/filesystem/MemFS';

describe('ProjectLoader', () => {
    let memfs: MemFS;

    beforeEach(() => {
        memfs = new MemFS();
    });

    it('should load project files', () => {
        const project = {
            files: [
                { path: 'index.js', code: 'console.log("hi")' },
                { path: 'utils.js', code: 'module.exports = {}' }
            ],
            entrypoint: 'index.js'
        };

        const result = ProjectLoader.loadProject(project);
        expect(result.fileCount).toBe(2);
        expect(result.entrypoint).toBe('index.js');
    });

    it('should write files to MemFS', () => {
        const project = {
            files: [
                { path: 'src/index.js', code: 'main' }
            ],
            entrypoint: 'src/index.js'
        };

        ProjectLoader.writeProjectFiles(project, memfs);
        expect(memfs.exists('/src/index.js')).toBe(true);
        expect(memfs.read('/src/index.js').toString()).toBe('main');
    });

    it('should validate entrypoint', () => {
        const project = {
            files: [],
            entrypoint: 'missing.js'
        };
        expect(() => ProjectLoader.loadProject(project)).toThrow(/Project empty/);
    });
});
