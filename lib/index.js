/**
 * @typedef {string} Assets
 * @typedef {string} Pages
 *
 * @callback Build
 * @param {Element} node
 * @returns {ElementChild|ElementChild[]}
 *
 * @typedef Options
 *   Configuration.
 * @property {Assets} [assets='assets']
 * @property {Pages} [pages='pages']
 *   How to create links.
 */

import {visit} from 'unist-util-visit'
import path from 'path';
import fs from 'fs';

/**
 * Plugin to automatically add links to headings (h1-h6).
 *
 * @type {import('unified').Plugin<[Options?]|void[], Root>}
 */
export function rehypeFOAMSvelteKit(options = {pages: 'pages', assets: 'assets'}) {

  const pages = options.pages || 'pages';
  const assets = options.assets || 'assets';
  const pagesAbsoultePath = path.resolve(pages);
  let currentFilename;
  function visitor(node, index, parent) {
    let url;
    switch(node.tagName) {
      case 'a':
        url = node.properties.href;
        break;
      case 'img':
      case 'video':
      case 'audio':
        url = node.properties.src;
        break;
    }

    // only process internal links
    if (url && !url.startsWith('http')) {
      const currentRelativePath = path.relative(pagesAbsoultePath, currentFilename);

      // gather pathname, query and hash to ensure we can reconstruct them
      const splitOne = url.split('?');
      let pathname = '';
      let hash = '';
      let query = '';
      if (splitOne.length > 1) {
        pathname = splitOne[0];
        const splitTwo = splitOne[1].split('#');
        if (splitTwo.length > 1) {
          query = '?' + splitTwo[0];
          hash = '#' + splitTwo[1];
        } else {
          query = '?' + splitOne[1];
        }
      } else {
        const splitTwo = splitOne[0].split('#');
        if (splitTwo.length > 1) {
          pathname = splitTwo[0];
          hash = '#' + splitTwo[1];
        } else {
          pathname = splitOne[0];
        }

      }

      if (pathname.startsWith('/')) {
        // ignore absolute path
      } else {

        if (pathname !== '') {
          // pathname != current

          const urlLocalPath = path.join(path.dirname(currentFilename), pathname);
          let relative = path.relative(currentFilename, urlLocalPath);

          const relativeToAssets = path.relative(path.resolve(assets), urlLocalPath);
          if (relativeToAssets.startsWith('..')) {
            // use absolute path solve everything it seems
            pathname = "/" + path.join(currentRelativePath, relative);
          } else {
            // keep for static assets
            pathname = relative;

            if (currentRelativePath === 'index.md') {
              // special case for index, static assets is actually at level
              pathname = pathname.replace(`../../${assets}/`, '');
            } else {
              pathname = pathname.replace(`../${assets}/`, '');
            }
          }
        } else {
          // hash link in current page
          if (hash.length > 0) {
            // TODO better
            if (currentRelativePath.endsWith('.md')) {
              pathname = "/" + currentRelativePath.slice(0, currentRelativePath.length - 3) + '/';
            } else {
              pathname = "/" + currentRelativePath + '/';
            }

          }

        }
      }

      if (pathname.endsWith('.md')) {
        pathname = pathname.slice(0, pathname.length - 3);
      }

      if (pathname.endsWith('index')) {
        pathname = pathname.slice(0, pathname.length - 5);
      }

      if (pathname.endsWith('index/')) {
        pathname = pathname.slice(0, pathname.length - 6);
      }

      if (!pathname.endsWith('/') && !(pathname.lastIndexOf('.') > pathname.lastIndexOf('/'))) {
        pathname = pathname + '/'
      }

      switch(node.tagName) {
        case 'a':
          node.properties.href = pathname + query + hash;
          break;
        case 'img':
        case 'video':
        case 'audio':
          node.properties.src = pathname + query + hash;
          break;
      }
    }
  }
    function transform(tree, file) {
    currentFilename = file.filename;
    visit(tree, ['element'], visitor);
  }
  return transform;
}


function listFolder(dir, files=[]) {
	fs.readdirSync(dir).forEach(f => {
		let dirPath = path.join(dir, f);
		let isDirectory = fs.statSync(dirPath).isDirectory();
		isDirectory
		? listFolder(dirPath, files)
		: files.push(path.join(dir, f));
	});
	return files;
}


/**
 * Plugin to automatically add links to headings (h1-h6).
 *
 * @type {import('unified').Plugin<[Options?]|void[], Root>}
 */
export function setupPermalLinkToHref(options = {pages: 'pages', assets: 'assets'}) {
  const pages = options.pages || 'pages';
  const filepaths = listFolder(pages);
  const pagePaths = filepaths.map(v => v.replace(/.md$/, '').replace(`${pages}/`, ''));
  const permalinks = [];
  const permalinkMap = {};
  for (const pagepath of pagePaths) {
    // console.log({pagepath})
    const splitted = pagepath.split('/');
    for (let i = 1; i <= splitted.length; i++) {
      const permalink = splitted.slice(splitted.length - i).join('/');
      const existingPagePath = permalinkMap[permalink];
      let toRegister = true;
      if (existingPagePath) {
        const existingSpliited = existingPagePath.split('/');
        if (existingSpliited.length >= splitted.length) {
          toRegister = true;
        } else {
          toRegister = false;
        }
      }
      if (toRegister) {
        // console.log(`register: ${permalink} => ${pagepath}`);
        permalinkMap[permalink] = pagepath;
        permalinks.push(permalink);
      }

    }
  }

  function hrefTemplates(permalink) {
    // if (!permalinkMap[permalink]) {
    // 	console.error(`not found ${permalink}`)
    // }
    let pagepath = permalinkMap[permalink];
    if (!pagepath) {
      return ""; // make link noops
    }
    // console.log(`${permalink} => ${pagepath}`)
    if (pagepath.endsWith('/index')) {
      pagepath = pagepath.substr(0, pagepath.length - 6);
    }

    // absolute path and then relativize it via adapter (ipfs )
    if (!pagepath.startsWith('/')) {
      pagepath = "/" + pagepath;
    }
    return pagepath
  }

  return {
    permalinks,
    hrefTemplates
  };
}

