/* eslint-disable @typescript-eslint/naming-convention */
import { MessageResponse } from '../deviceProtocol.js';

type ResponseToKey<R extends MsgResponse> = R extends { Type: infer T } ? T : never;

export interface Msg
{
    Type: string;
    MsgId: number;
}

export interface ResponseIdentifier<R extends MsgResponse>
{
    msgId: number,
    type: ResponseToKey<R>
}

export interface MsgAndResponseIdentifier<M extends Msg, R extends MsgResponse> extends Omit<MessageResponse<M, R>, '__responseType'> {
    responseIdentifier: ResponseIdentifier<R>;
}

export interface GetPatternDetailMsg extends Msg
{
    Type: 'GetPatternDetail';
    Id: string;
}

export interface GetPatternsMsg extends Msg
{
    Type: 'GetPatterns';
}

export interface PatternStartMsg extends Msg
{
    Type: 'PatternStart';
    Index: number;
}

export interface PatternMinMaxChangeMsg extends Msg
{
    Type: 'PatternMinMaxChange';
    MenuId: number;
    NewValue: number;
}

export interface PatternMultiChoiceChangeMsg extends Msg
{
    Type: 'PatternMultiChoiceChange';
    MenuId: number;
    ChoiceId: number;
}

export interface PatternSoftButtonMsg extends Msg
{
    Type: 'PatternSoftButton';
    Pressed: 0 | 1;
}

export interface SetPowerMsg extends Msg
{
    Type: 'SetPower';
    Chan1: number;
    Chan2: number;
    Chan3: number;
    Chan4: number;
}

export interface PatternStopMsg extends Msg
{
    Type: 'PatternStop';
}

export interface GetVersionMsg extends Msg
{
    Type: 'GetVersion';
}

export interface LuaStartMsg extends Msg
{
    Type: 'LuaStart';
    Index: number;
}

export interface LuaEndMsg extends Msg
{
    Type: 'LuaEnd';
}

export interface LuaLineMsg extends Msg
{
    Type: 'LuaLine';
    LineNumber: number;
    Text: string;
}

export interface GetLuaScriptsMsg extends Msg
{
    Type: 'GetLuaScripts';
}

export interface DeleteLuaScriptMsg extends Msg
{
    Type: 'DeleteLuaScript';
    Index: number;
}

export interface MsgResponse
{
    Type: string;
    MsgId: number;
    Result: 'OK' | 'ERROR'
    Error?: string;
}

export interface AckMsgResponse extends MsgResponse {
    Type: 'Ack',
}

export interface VersionMsgResponse extends MsgResponse
{
    Type: 'VersionDetails',
    ZC95: string;
    WsMajor: number;
    WsMinor: number;
}

interface PatternDetail
{
    Type: 'PatternDetail',
    Id: number;
    Name: string;
}

export interface PatternsMsgResponse extends MsgResponse
{
    Type: 'PatternList',
    Patterns: PatternDetail[];
}

interface ChannelPowerStatus
{
    Channel: number;
    OutputPower: number;
    MaxOutputPower: number;
    PowerLimit: number;
}

export interface PowerStatusMsgResponse extends MsgResponse
{
    Channels: ChannelPowerStatus[]
}

export interface MenuItem
{
    Id: number;
    Title: string;
    Group: number;
    Type: 'MIN_MAX' | 'MULTI_CHOICE';
    Default: number;
}

export interface MinMaxMenuItem extends MenuItem
{
    Min: number;
    Max: number;
    IncrementStep: number;
    UoM: string;
}

export interface MultiChoiceMenuItem extends MenuItem
{
    Choices: { Id: number; Name: string }[];
}

export interface PatternDetailsMsgResponse extends MsgResponse
{
    Type: 'PatternDetail',
    Name: string;
    Id: number;
    ButtonA: string;
    MenuItems: (MinMaxMenuItem | MultiChoiceMenuItem)[];
}

type LuaScriptInfo = {
    Index: number;
    Empty: boolean;
    Valid: boolean;
    Name: string;
}

export interface GetLuaScriptsMsgResponse extends MsgResponse
{
    Scripts: LuaScriptInfo[];
}

export default class Zc95MessageFactory
{
    private msgId: number = 0;

    public createGetPatterns(): MsgAndResponseIdentifier<GetPatternsMsg, PatternsMsgResponse> {
        const msgId = this.getNextMsgIndex();
        return {
            message: {
                Type: 'GetPatterns',
                MsgId: msgId,
            },
            responseIdentifier: {
                msgId: msgId,
                type: 'PatternList',
            },
        };
    }

    public createGetPatternDetails(patternId: number): MsgAndResponseIdentifier<GetPatternDetailMsg, PatternDetailsMsgResponse> {
        const msgId = this.getNextMsgIndex();
        return {
            message: {
                Type: 'GetPatternDetail',
                MsgId: msgId,
                Id: String(patternId)
            },
            responseIdentifier: {
                msgId: msgId,
                type: 'PatternDetail',
            },
        };
    }

    public createPatternStart(patternId: number): MsgAndResponseIdentifier<PatternStartMsg, AckMsgResponse> {
        const msgId = this.getNextMsgIndex();
        return {
            message: {
                Type: 'PatternStart',
                MsgId: msgId,
                Index: patternId
            },
            responseIdentifier: {
                msgId: msgId,
                type: 'Ack',
            },
        };
    }

    public createPatternMinMaxChange(
        menuId: number, newValue: number
    ): MsgAndResponseIdentifier<PatternMinMaxChangeMsg, AckMsgResponse> {
        const msgId = this.getNextMsgIndex();
        return {
            message: {
                Type: 'PatternMinMaxChange',
                MsgId: msgId,
                MenuId: menuId,
                NewValue: newValue
            },
            responseIdentifier: {
                msgId: msgId,
                type: 'Ack',
            }
        };
    }

    public createPatternMultiChoiceChange(
        menuId: number, choiceId: number
    ): MsgAndResponseIdentifier<PatternMultiChoiceChangeMsg, AckMsgResponse> {
        const msgId = this.getNextMsgIndex();
        return {
            message: {
                Type: 'PatternMultiChoiceChange',
                MsgId: msgId,
                MenuId: menuId,
                ChoiceId: choiceId,
            },
            responseIdentifier: {
                msgId: msgId,
                type: 'Ack',
            },

        };
    }

    public createPatternSoftButton(pressed: boolean): MsgAndResponseIdentifier<PatternSoftButtonMsg, AckMsgResponse> {
        const msgId = this.getNextMsgIndex();
        return {
            message: {
                Type: 'PatternSoftButton',
                MsgId: msgId,
                Pressed: pressed ? 1 : 0
            },
            responseIdentifier: {
                msgId: msgId,
                type: 'Ack',
            }
        };
    }

    public createSetPower(
        chan1: number, chan2: number, chan3: number, chan4: number
    ): MsgAndResponseIdentifier<SetPowerMsg, AckMsgResponse> {
        const msgId = this.getNextMsgIndex();
        return {
            message: {
                Type: 'SetPower',
                MsgId: msgId,
                Chan1: chan1,
                Chan2: chan2,
                Chan3: chan3,
                Chan4: chan4
            },
            responseIdentifier: {
                msgId: msgId,
                type: 'Ack',
            }
        };
    }

    public createPatternStop(): MsgAndResponseIdentifier<PatternStopMsg, AckMsgResponse> {
        const msgId = this.getNextMsgIndex();
        return {
            message: {
                Type: 'PatternStop',
                MsgId: msgId,
            },
            responseIdentifier: {
                msgId: msgId,
                type: 'Ack',
            },
        };
    }

    public createGetVersionDetails(): MsgAndResponseIdentifier<GetVersionMsg, VersionMsgResponse> {
        const msgId = this.getNextMsgIndex();
        return {
            message: {
                Type: 'GetVersion',
                MsgId: msgId,
            },
            responseIdentifier: {
                msgId: msgId,
                type: 'VersionDetails',
            }
        };
    }

    public createLuaStart(index: number): MsgAndResponseIdentifier<LuaStartMsg, AckMsgResponse> {
        const msgId = this.getNextMsgIndex();
        return {
            message: {
                Type: 'LuaStart',
                MsgId: msgId,
                Index: index
            },
            responseIdentifier: {
                msgId: msgId,
                type: 'Ack',
            }
        };
    }

    public createLuaLine(lineNumber: number, text: string): MsgAndResponseIdentifier<LuaLineMsg, AckMsgResponse> {
        const msgId = this.getNextMsgIndex();
        return {
            message: {
                Type: 'LuaLine',
                MsgId: msgId,
                LineNumber: lineNumber,
                Text: text.trimEnd()
            },
            responseIdentifier: {
                msgId: msgId,
                type: 'Ack',
            }
        };
    }

    public createLuaEnd(): MsgAndResponseIdentifier<LuaEndMsg, AckMsgResponse> {
        const msgId = this.getNextMsgIndex();
        return {
            message: {
                Type: 'LuaEnd',
                MsgId: msgId,
            },
            responseIdentifier: {
                msgId: msgId,
                type: 'Ack',
            }
        };
    }

    public createGetLuaScripts(): MsgAndResponseIdentifier<GetLuaScriptsMsg, GetLuaScriptsMsgResponse> {
        const msgId = this.getNextMsgIndex();
        return {
            message: {
                Type: 'GetLuaScripts',
                MsgId: msgId,
            },
            responseIdentifier: {
                msgId: msgId,
                type: 'LuaScripts',
            }
        };
    }

    public createDeleteLuaScript(index: number): MsgAndResponseIdentifier<DeleteLuaScriptMsg, AckMsgResponse> {
        const msgId = this.getNextMsgIndex();
        return {
            message: {
                Type: 'DeleteLuaScript',
                MsgId: msgId,
                Index: index
            },
            responseIdentifier: {
                msgId: msgId,
                type: 'Ack',
            }
        };
    }

    private getNextMsgIndex(): number {
        if (this.msgId > 10000) {
            this.msgId = 0;
        }

        return ++this.msgId;
    }
}
