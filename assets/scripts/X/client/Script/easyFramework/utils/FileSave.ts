import { _decorator, Component, Node } from 'cc';
import {HTML5} from 'cc/env';
const { ccclass, property } = _decorator;

@ccclass('FileSave')
export class FileSave extends Component {
    
    public static saveForBrowser(textToWrite:string, fileNameToSaveAs:string) {
        if (HTML5) {
            console.log("浏览器");
            // let textFileAsBlob = new Blob([textToWrite], {type:'application/json'});
            let textFileAsBlob = new Blob([textToWrite], {type:'application/csv'});
            let downloadLink = document.createElement("a");
            downloadLink.download = fileNameToSaveAs;
            downloadLink.innerHTML = "Download File";
            if (window.webkitURL != null)
            {
                // Chrome allows the link to be clicked
                // without actually adding it to the DOM.
                downloadLink.href = window.webkitURL.createObjectURL(textFileAsBlob);
            }
            else
            {
                // Firefox requires the link to be added to the DOM
                // before it can be clicked.
                downloadLink.href = window.URL.createObjectURL(textFileAsBlob);
                // downloadLink.onclick = destroyClickedElement;
                downloadLink.style.display = "none";
                document.body.appendChild(downloadLink);
            }
            downloadLink.click();
        }
    }

   
}

