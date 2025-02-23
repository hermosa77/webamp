import { MakiTree, ModernAction, ModernStore, XmlTree } from "./types";
import JSZip from "jszip";
import * as Utils from "./utils";
import initialize from "./initialize";
import { run } from "./maki-interpreter/virtualMachine";
import System from "./runtime/System";
import runtime from "./runtime";

async function getZipFromUrl(skinUrl: string): Promise<JSZip> {
  const resp = await fetch(skinUrl);
  const blob = await resp.blob();
  return JSZip.loadAsync(blob);
}

export function setMakiTree(makiTree: MakiTree): ModernAction {
  return { type: "SET_MAKI_TREE", makiTree };
}

export function setXmlTree(xmlTree: XmlTree): ModernAction {
  return { type: "SET_XML_TREE", xmlTree };
}

export function gotSkinUrl(skinUrl: string, store: ModernStore) {
  return async dispatch => {
    const zip = await getZipFromUrl(skinUrl);

    const xmlTree = await Utils.inlineIncludes(
      await Utils.readXml(zip, "skin.xml"),
      zip
    );

    dispatch(setXmlTree(xmlTree));

    const makiTree = await initialize(zip, xmlTree);
    // Execute scripts
    await Utils.asyncTreeFlatMap(makiTree, node => {
      switch (node.name) {
        case "groupdef": {
          // removes groupdefs from consideration (only run scripts when actually referenced by group)
          return {};
        }
        case "script": {
          // TODO: stop ignoring standardframe
          if (node.attributes.file.endsWith("standardframe.maki")) {
            break;
          }
          const scriptGroup = Utils.findParentNodeOfType(node, [
            "group",
            "WinampAbstractionLayer",
            "WasabiXML",
          ]);
          const system = new System(scriptGroup, store);
          run({
            runtime,
            data: node.js_annotations.script,
            system,
            log: false,
          });
          return node;
        }
        default: {
          return node;
        }
      }
    });

    dispatch(setMakiTree(makiTree));
  };
}

export function setVolume(volume: number) {
  return { type: "SET_VOLUME", volume };
}
