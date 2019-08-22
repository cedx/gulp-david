import {Dependency, DependencyMap, getDependencies, GetDependenciesFunction, GetDependenciesOptions, getUpdatedDependencies} from 'david';
import {Transform, TransformCallback} from 'stream';
import {promisify} from 'util';
import File from 'vinyl';
import {ConsoleReporter, Reporter} from './reporter';

/** Checks whether the dependencies of a project are out of date. */
export class Checker extends Transform {

  /** The condition indicating that an error occurred. */
  error: ErrorCondition = {
    404: false,
    depCount: 0,
    depType: false,
    scm: false
  };

  /** The list of dependencies to ignore. */
  ignore: string[];

  /** The [npm](https://www.npmjs.com) registry URL. */
  registry: URL;

  /** The instance used to output the report. */
  reporter: Reporter | null;

  /** Value indicating whether to use unstable dependencies. */
  unstable: boolean;

  /** The operator to use in version comparators. */
  update: string;

  /** Value indicating whether to output the versions of all dependencies instead of only the outdated ones. */
  verbose: boolean;

  /**
   * Creates a new checker.
   * @param {object} options An object specifying values used to initialize this instance.
   */
  constructor(options: CheckerOptions = {}) {
    super({objectMode: true});

    const {
      ignore = [],
      registry = new URL('https://registry.npmjs.org/'),
      reporter = new ConsoleReporter,
      unstable = false,
      update = '',
      verbose = false
    } = options;

    this.ignore = ignore;
    this.registry = registry;
    this.reporter = reporter;
    this.unstable = unstable;
    this.update = update;
    this.verbose = verbose;
  }

  /**
   * Gets details about project dependencies.
   * @param manifest The manifest providing the dependencies.
   * @return An object providing details about the dependencies.
   */
  async getDependencies(manifest: JsonMap): Promise<DependencyReport> {
    return this._getDependencies(getDependencies, manifest);
  }

  /**
   * Gets details about project dependencies that are outdated.
   * @param manifest The manifest providing the dependencies.
   * @return An object providing details about the dependencies that are outdated.
   */
  async getUpdatedDependencies(manifest: JsonMap): Promise<DependencyReport> {
    return this._getDependencies(getUpdatedDependencies, manifest);
  }

  /**
   * Parses the manifest contained in the specified file.
   * @param file The file to read.
   * @param encoding The file encoding.
   * @return A manifest providing a list of dependencies.
   * @throws {Error} The file is a stream, or the manifest is invalid.
   */
  parseManifest(file: File, encoding: string = 'utf8'): JsonMap {
    if (file.isNull()) throw new Error(`Empty manifest: ${file.path}`);
    if (file.isStream()) throw new Error('Streams are not supported.');

    const manifest = JSON.parse((file.contents as Buffer).toString(encoding));
    if (typeof manifest != 'object' || !manifest) throw new Error('Invalid manifest format.');
    return manifest;
  }

  /**
   * Transforms input and produces output.
   * @param file The chunk to transform.
   * @param encoding The encoding type if the chunk is a string.
   * @param callback The function to invoke when the supplied chunk has been processed.
   * @return The transformed chunk.
   */
  async _transform(file: File, encoding: string = 'utf8', callback?: TransformCallback): Promise<File> {
    const getDeps = (mf: JsonMap) => this.verbose ? this.getDependencies(mf) : this.getUpdatedDependencies(mf);

    try {
      const manifest = this.parseManifest(file);
      const deps = await getDeps(manifest);
      file.david = deps;
      if (this.reporter) this.reporter.log(file);

      if (this.update.length) {
        for (const type of Object.keys(deps))
          for (const [name, dependency] of Object.entries(deps[type]!) as Array<[string, Dependency]>)
            manifest[type][name] = this.update + (this.unstable ? dependency.latest : dependency.stable);

        file.contents = Buffer.from(JSON.stringify(manifest, null, 2), encoding as BufferEncoding);
      }

      const count = Object.keys(deps).reduce((previousValue, type) => previousValue + Object.keys(deps[type]!).length, 0);
      if (this.error.depCount > 0 && count >= this.error.depCount) throw new Error(`Outdated dependencies: ${count}`);
      if (callback) callback(null, file);
    }

    catch (err) {
      if (callback) callback(new Error(`[@cedx/gulp-david] ${err.message}`));
      else throw err;
    }

    return file;
  }

  /**
   * Gets details about project dependencies.
   * @param getter The function invoked to fetch the dependency details.
   * @param manifest The manifest providing the list of dependencies.
   * @return An object providing details about the project dependencies.
   */
  async _getDependencies(getter: GetDependenciesFunction, manifest: JsonMap): Promise<DependencyReport> {
    const options: GetDependenciesOptions = {
      error: {E404: this.error['404'], EDEPTYPE: this.error.depType, ESCM: this.error.scm},
      ignore: this.ignore,
      loose: true,
      stable: !this.unstable
    };

    if (this.registry) options.npm = {
      registry: this.registry.href
    };

    const getDeps = promisify<object, GetDependenciesOptions, DependencyMap>(getter);
    const [dependencies, devDependencies, optionalDependencies] = await Promise.all([
      getDeps(manifest, {...options, dev: false, optional: false}),
      getDeps(manifest, {...options, dev: true, optional: false}),
      getDeps(manifest, {...options, dev: false, optional: true})
    ]);

    return {dependencies, devDependencies, optionalDependencies};
  }
}
