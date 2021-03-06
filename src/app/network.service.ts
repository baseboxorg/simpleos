import {Injectable} from '@angular/core';
import {AccountsService} from './accounts.service';
import {EOSJSService} from './eosjs.service';
import {Router} from '@angular/router';

import * as Eos from '../assets/eos.js';
import {BehaviorSubject} from 'rxjs';

export interface Endpoint {
  url: string;
  owner: string;
  latency: number;
  filters: string[];
}

@Injectable({
  providedIn: 'root'
})
export class NetworkService {

  publicEndpoints: Endpoint[];
  eos: any;
  mainnetId = 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906';
  genesistx = 'ad77575a8b4f52e477682e712b1cbd884299468db6a94d909f90c6961cea9b02';
  voteref = 'b23f537e8ab29fbcec8b533081ef7e12b146899ca42a3fc9eb608258df9983d9';
  txrefBlock = 191;
  voterefBlock = 572278;
  baseConfig = {
    httpEndpoint: '',
    expireInSeconds: 60,
    broadcast: true,
    debug: false,
    sign: true,
    chainId: ''
  };
  validEndpoints: Endpoint[];
  selectedEndpoint = new BehaviorSubject<Endpoint>(null);
  networkingReady = new BehaviorSubject<boolean>(false);

  constructor(private eosjs: EOSJSService, private router: Router, public aService: AccountsService) {
    this.publicEndpoints = [
      {url: 'http://br.eosrio.io:8080', owner: 'EOS Rio', latency: 0, filters: []},
      {url: 'http://api.eosnewyork.io', owner: 'EOS New York', latency: 0, filters: []},
      {url: 'https://eos.greymass.com', owner: 'Greymass', latency: 0, filters: []},
      // {url: 'http://bp.cryptolions.io:8888', owner: 'CryptoLions', latency: 0, filters: []},
      // {url: 'http://mainnet.eoscalgary.io', owner: 'EOS Cafe', latency: 0, filters: []},
      // {url: 'http://api.hkeos.com', owner: 'HK EOS', latency: 0, filters: []},
      // {url: 'https://dc1.eosemerge.io:5443', owner: 'EOS Emerge Poland', latency: 0, filters: []},
      // {url: 'http://dc1.eosemerge.io:8888', owner: 'EOS Emerge Poland', latency: 0, filters: []},
    ];
    this.validEndpoints = [];
  }

  connect() {
    this.scanNodes().then(() => {
      this.verifyFilters().then(() => {
        this.extractValidNode();
      });
    });
  }

  async scanNodes() {
    for (const apiNode of this.publicEndpoints) {
      await this.apiCheck(apiNode);
    }
  }

  extractValidNode() {
    for (const node of this.publicEndpoints) {
      if (node.filters.length === 2) {
        this.validEndpoints.push(node);
      }
    }
    this.selectEndpoint();
  }

  selectEndpoint() {
    let latency = 2000;
    this.validEndpoints.forEach((node) => {
      if (node.latency < latency) {
        latency = node.latency;
        this.selectedEndpoint.next(node);
      }
    });
    // console.log('Best Server Selected!', this.selectedEndpoint.getValue().url);
    this.startup();
  }

  async verifyFilters() {
    for (const apiNode of this.publicEndpoints) {
      if (apiNode.latency > 0 && apiNode.latency < 1000) {
        await this.filterCheck(apiNode);
      }
    }
  }

  filterCheck(server: Endpoint) {
    console.log('Starting filter check for ' + server.url);
    const config = this.baseConfig;
    config.httpEndpoint = server.url;
    config.chainId = this.mainnetId;
    const eos = Eos(config);
    const pq = [];
    pq.push(new Promise((resolve1) => {
      eos['getTransaction'](this.genesistx, (err, txInfo) => {
        if (err) {
          console.log(err);
          resolve1();
        } else {
          if (txInfo['block_num'] === this.txrefBlock) {
            server.filters.push('eosio.token:transfer');
          } else {
            console.log('eosio.token:transfer filter is disabled on ' + server.url);
          }
          resolve1();
        }
      });
    }));
    pq.push(new Promise((resolve1) => {
      eos['getTransaction'](this.voteref, (err, txInfo) => {
        if (err) {
          console.log(err);
          resolve1();
        } else {
          if (txInfo['block_num'] === this.voterefBlock) {
            server.filters.push('eosio:voteproducer');
          } else {
            console.log('eosio:voteproducer filter is disabled on ' + server.url);
          }
          resolve1();
        }
      });
    }));
    return Promise.all(pq);
  }

  apiCheck(server: Endpoint) {
    console.log('Starting latency check for ' + server.url);
    return new Promise((resolve, reject) => {
      const config = this.baseConfig;
      config.httpEndpoint = server.url;
      config.chainId = this.mainnetId;
      const eos = Eos(config);
      const refTime = new Date().getTime();
      try {
        eos['getInfo']({}, (err, chainInfo) => {
          if (err) {
            server.latency = -1;
          } else {
            server.latency = ((new Date().getTime()) - refTime);
          }
          resolve();
        });
      } catch (e) {
        server.latency = -1;
        resolve();
      }
    });
  }

  startup() {
    this.networkingReady.next(true);
    this.eosjs.init(this.selectedEndpoint.getValue().url, this.mainnetId).then((savedAccounts: any) => {
      if (savedAccounts) {
        if (savedAccounts.length > 0) {
          this.aService.loadLocalAccounts(savedAccounts);
          this.router['navigate'](['dashboard', 'vote']);
        } else {
          console.log('No saved accounts!');
        }
      }
    }).catch(() => {
      this.networkingReady.next(false);
    });
  }

}
