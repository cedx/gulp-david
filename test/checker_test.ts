/* tslint:disable: no-unused-expression */
import {expect} from 'chai';
import {suite, test, timeout} from 'mocha-typescript';
import {Readable} from 'stream';
import * as File from 'vinyl';

// @ts-ignore: disable processing of the imported JSON file.
import * as pkg from '../package.json';
import {Checker, ConsoleReporter} from '../src';

/** Tests the features of the [[Checker]] class. */
@suite(timeout(15000))
class CheckerTest {

  /** Tests the `Checker` constructor. */
  @test testFactory(): void {
    // It should return a `Checker` with a `ConsoleReporter`.
    let checker = new Checker;
    expect(checker).to.be.an.instanceof(Checker);
    expect(checker.reporter).to.be.an.instanceof(ConsoleReporter);

    // It should properly initialize the instance properties.
    checker = new Checker({
      ignore: ['@cedx/gulp-david'],
      registry: new URL('https://dev.belin.io/gulp-david'),
      reporter: {log(file: File) { /* Noop */ }},
      unstable: true,
      update: '='
    });

    checker.error = {
      404: true,
      depCount: 123,
      depType: true,
      scm: true
    };

    expect(checker.error).to.deep.equal({
      404: true,
      depCount: 123,
      depType: true,
      scm: true
    });

    expect(checker.ignore).to.include('@cedx/gulp-david');
    expect(checker.registry).to.be.instanceOf(URL).and.have.property('href').that.equal('https://dev.belin.io/gulp-david');
    expect(checker.reporter).to.be.an('object').and.have.property('log');
    expect(checker.unstable).to.be.true;
    expect(checker.update).to.equal('=');
  }

  /** Tests the `Checker#getDependencies` method. */
  @test async testGetDependencies(): Promise<void> {
    // It should return an object with 3 dependency properties.
    let deps = await (new Checker).getDependencies({name: '@cedx/gulp-david'});
    expect(deps).to.contain.all.keys('dependencies', 'devDependencies', 'optionalDependencies');

    // It should have some non-empty dependencies for the current manifest.
    deps = await (new Checker).getDependencies(pkg);
    expect(Object.keys(deps.dependencies)).to.not.be.empty;
    expect(Object.keys(deps.devDependencies)).to.not.be.empty;

    // It should not have optional dependencies for the current manifest.
    expect(Object.keys(deps.optionalDependencies)).to.be.empty;
  }

  /** Tests the `Checker#getUpdatedDependencies` method. */
  @test async testGetUpdatedDependencies(): Promise<void> {
    // It should return an object with 3 dependency properties.
    let deps = await (new Checker).getUpdatedDependencies({name: '@cedx/gulp-david'});
    expect(deps).to.contain.all.keys('dependencies', 'devDependencies', 'optionalDependencies');

    // It should not have optional dependencies for the current manifest.
    deps = await (new Checker).getUpdatedDependencies(pkg);
    expect(Object.keys(deps.optionalDependencies)).to.be.empty;
  }

  /** Tests the `Checker#parseManifest` method. */
  @test testParseManifest(): void {
    // It should throw an error if the file is null.
    expect(() => (new Checker).parseManifest(new File)).to.throw();

    // It should throw an error if the file is a stream.
    expect(() => (new Checker).parseManifest(new File({contents: new Readable}))).to.throw();

    // It should throw an error if the manifest is invalid.
    expect(() => (new Checker).parseManifest(new File({contents: Buffer.from('FooBar')}))).to.throw();

    // It should return an object if the manifest is valid.
    const file = new File({contents: Buffer.from('{"name": "@cedx/gulp-david"}')});
    expect((new Checker).parseManifest(file)).to.deep.equal({name: '@cedx/gulp-david'});
  }

  /** Tests the `Checker#_transform` method. */
  @test async testTransform(): Promise<void> {
    let input;

    // It should throw an error if the manifest is invalid.
    try {
      input = new File({contents: Buffer.from('FooBar')});
      await (new Checker)._transform(input);
      expect(true).to.not.be.ok;
    }

    catch (err) {
      expect(err).to.be.an.instanceof(Error);
    }

    // It should add a "david" property to the file object.
    input = new File({contents: Buffer.from('{"name": "@cedx/gulp-david"}')});
    const file = await (new Checker)._transform(input);
    expect(file).to.have.property('david').that.is.an('object');
  }
}
