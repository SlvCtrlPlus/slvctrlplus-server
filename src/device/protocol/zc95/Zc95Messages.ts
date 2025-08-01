import {Zc95Serial} from "./Zc95Serial.js";

export class Zc95Messages {
    private connection: Zc95Serial;
    private msgId: number = 1;
    private debug: boolean;

    public constructor(connection: Zc95Serial, debug: boolean) {
        this.connection = connection;
        this.debug = debug;
    }

    private send(message: any): void {
        const msgToSend = JSON.stringify(message);
        if (this.debug) console.log("> ", msgToSend);
        this.connection.send(msgToSend);
    }

    private async getResponse(expectedMsgId: number, expectedType: string): Promise<any> {
        const resultJson = await this.connection.recv(expectedMsgId);
        if (!resultJson) {
            throw new Error(`Didn't get any message, expected ${expectedType} (msgId = ${expectedMsgId})`);
        }

        const result = JSON.parse(resultJson);
        if (result.Type !== expectedType) {
            throw new Error(`Didn't get expected ${expectedType} message type (msgId = ${expectedMsgId})`);
        }

        if (result.MsgId !== expectedMsgId) {
            throw new Error(`Unexpected MsgId received (expected msgId = ${expectedMsgId})`);
        }

        if (!result.Result || result.Result !== "OK") {
            const error = result.Error;
            if (error == null) {
                throw new Error("Unknown error.");
            } else {
                throw new Error(`Got error message: ${error}` );
            }
        }

        return result;
    }

    public async getPatterns(): Promise<any[]> {
        this.msgId++;
        const message = {
            Type: "GetPatterns",
            MsgId: this.msgId
        };
        this.send(message);
        const response = await this.getResponse(this.msgId, "PatternList");
        return response?.Patterns ?? [];
    }

    public async getPatternDetails(patternId: number): Promise<any | undefined> {
        this.msgId++;
        const message = {
            Type: "GetPatternDetail",
            MsgId: this.msgId,
            Id: patternId
        };
        this.send(message);
        const response = await this.getResponse(this.msgId, "PatternDetail");
        if (this.debug) console.log(JSON.stringify(response, null, 2));
        return response;
    }

    public async patternStart(patternId: number): Promise<void> {
        this.msgId++;
        const message = {
            Type: "PatternStart",
            MsgId: this.msgId,
            Index: patternId
        };
        this.send(message);
        await this.getResponse(this.msgId, "Ack");
    }

    public async patternMinMaxChange(menuId: number, newValue: number): Promise<void> {
        this.msgId++;
        const message = {
            Type: "PatternMinMaxChange",
            MsgId: this.msgId,
            MenuId: menuId,
            NewValue: newValue
        };
        this.send(message);
        await this.getResponse(this.msgId, "Ack");
    }

    public async patternMultiChoiceChange(menuId: number, choiceId: number): Promise<void> {
        this.msgId++;
        const message = {
            Type: "PatternMultiChoiceChange",
            MsgId: this.msgId,
            MenuId: menuId,
            ChoiceId: choiceId
        };
        this.send(message);
        await this.getResponse(this.msgId, "Ack");
    }

    public async patternSoftButton(pressed: boolean): Promise<void> {
        this.msgId++;
        const message = {
            Type: "PatternSoftButton",
            MsgId: this.msgId,
            Pressed: pressed ? 1 : 0
        };
        this.send(message);
        await this.getResponse(this.msgId, "Ack");
    }

    public async sendSetPowerMessage(chan1: number, chan2: number, chan3: number, chan4: number): Promise<void> {
        this.msgId++;
        const message = {
            Type: "SetPower",
            MsgId: this.msgId,
            Chan1: chan1,
            Chan2: chan2,
            Chan3: chan3,
            Chan4: chan4
        };
        this.send(message);
        await this.getResponse(this.msgId, "Ack");
    }

    public async sendPatternStopMessage(): Promise<void> {
        this.msgId++;
        const message = {
            Type: "PatternStop",
            MsgId: this.msgId
        };
        this.send(message);
        await this.getResponse(this.msgId, "Ack");
    }

    public async getVersionDetails(): Promise<any | undefined> {
        this.msgId++;
        const message = {
            Type: "GetVersion",
            MsgId: this.msgId
        };
        this.send(message);
        return await this.getResponse(this.msgId, "VersionDetails");
    }

    public async sendLuaStart(index: number): Promise<any | undefined> {
        this.msgId++;
        const message = {
            Type: "LuaStart",
            MsgId: this.msgId,
            Index: index
        };
        this.send(message);
        return await this.getResponse(this.msgId, "Ack");
    }

    public async sendLuaLine(lineNumber: number, text: string): Promise<any | undefined> {
        this.msgId++;
        const message = {
            Type: "LuaLine",
            MsgId: this.msgId,
            LineNumber: lineNumber,
            Text: text.trimEnd()
        };
        this.send(message);
        return await this.getResponse(this.msgId, "Ack");
    }

    public async sendLuaEnd(): Promise<any | undefined> {
        this.msgId++;
        const message = {
            Type: "LuaEnd",
            MsgId: this.msgId
        };
        this.send(message);
        return await this.getResponse(this.msgId, "Ack");
    }

    public async sendGetLuaScripts(): Promise<any[] | undefined> {
        this.msgId++;
        const message = {
            Type: "GetLuaScripts",
            MsgId: this.msgId
        };
        this.send(message);
        const response = await this.getResponse(this.msgId, "LuaScripts");
        return response?.Scripts;
    }

    public async sendDeleteLuaScript(index: number): Promise<any | undefined> {
        this.msgId++;
        const message = {
            Type: "DeleteLuaScript",
            MsgId: this.msgId,
            Index: index
        };
        this.send(message);
        return await this.getResponse(this.msgId, "Ack");
    }
}
