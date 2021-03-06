import {AfterViewInit, Component, OnDestroy, OnInit} from '@angular/core';
import {VotingService} from './voting.service';
import {AccountsService} from '../../accounts.service';
import {EOSJSService} from '../../eosjs.service';
import {FormBuilder, FormGroup, Validators} from '@angular/forms';
import {BodyOutputType, Toast, ToasterConfig, ToasterService} from 'angular2-toaster';
import {ISubscription, Subscription} from 'rxjs-compat/Subscription';

@Component({
  selector: 'app-vote',
  templateUrl: './vote.component.html',
  styleUrls: ['./vote.component.css']
})
export class VoteComponent implements OnInit, AfterViewInit {
  max: number;
  min: number;
  valuetoStake: number;
  percenttoStake: number;
  stakeModal: boolean;
  voteModal: boolean;
  nVotes: number;
  busy: boolean;
  totalBalance: number;
  stakedBalance: number;
  singleSelectionBP: any;
  selectedBPs: any[];
  wrongpass: string;
  passForm: FormGroup;
  config: ToasterConfig;

  constructor(public voteService: VotingService, public aService: AccountsService, public eos: EOSJSService,
              private fb: FormBuilder, private toaster: ToasterService) {
    this.max = 100;
    this.min = 0;
    this.valuetoStake = 0;
    this.percenttoStake = 0;
    this.stakeModal = false;
    this.voteModal = false;
    this.busy = false;
    this.totalBalance = 0;
    this.stakedBalance = 0;
    this.wrongpass = '';
    this.singleSelectionBP = {
      name: ''
    };
    this.selectedBPs = [];
    this.passForm = this.fb.group({
      pass: ['', [Validators.required, Validators.minLength(10)]]
    });
  }

  ngOnInit() {
    const selectedAcc = this.aService.selected.getValue();
    this.aService.selected.asObservable().subscribe((selected: any) => {
      if (selected) {
        this.totalBalance = selected.full_balance;
        this.stakedBalance = selected.staked;
        this.loadPlacedVotes(selected);
      }
    });
    this.voteService.listReady.asObservable().subscribe((state) => {
      if (state) {
        this.updateCounter();
      }
    });
    this.aService.accounts.forEach((a) => {
      if (a) {
        if (a.name === selectedAcc.name) {
          const currentVotes = a.details['voter_info']['producers'];
          this.voteService.bps.forEach((elem) => {
            elem.checked = currentVotes.indexOf(elem.account) !== -1;
          });
        }
      }
    });
  }

  ngAfterViewInit() {
    this.voteService.listProducers();
  }

  shuffleBps() {
    this.voteService.randomizeList();
  }

  processVotes() {
    this.selectedBPs = [];
    this.voteService.bps.forEach((bp) => {
      if (bp.checked) {
        this.selectedBPs.push(bp.account);
      }
    });
    this.passForm.reset();
    this.voteModal = true;
  }

  updateCounter() {
    let val = 0;
    this.voteService.bps.forEach((bp) => {
      if (bp.checked) {
        val++;
      }
    });
    this.nVotes = val;
  }

  modalVote(pass) {
    this.busy = true;
    const voter = this.aService.selected.getValue();
    const publicKey = voter.details.permissions[0].required_auth.keys[0].key;
    this.eos.authenticate(pass, publicKey).then((data) => {
      if (data === true) {
        this.eos.voteProducer(voter.name, this.selectedBPs).then((txdata) => {
          this.wrongpass = '';
          this.voteModal = false;
          this.busy = false;
          this.showToast('success', 'Vote broadcasted', 'Check your history for confirmation.');
          this.passForm.reset();
          this.aService.refreshFromChain();
          setTimeout(() => {
            this.loadPlacedVotes(this.aService.selected.getValue());
          }, 500);
        }).catch((err2) => {
          if (err2.error.code === 3081001) {
            this.wrongpass = 'Not enough stake to perform this action.';
          } else {
            this.wrongpass = err2.error['what'];
          }
          this.busy = false;
        });
      } else {
        this.wrongpass = 'Something went wrong!';
        this.busy = false;
      }
    }).catch((err) => {
      this.busy = false;
      this.wrongpass = 'Wrong password!';
    });
  }

  loadPlacedVotes(selectedAccount) {
    const currentVotes = selectedAccount.details['voter_info']['producers'];
    this.nVotes = currentVotes.length;
    this.voteService.bps.forEach((elem) => {
      elem.checked = currentVotes.indexOf(elem.account) !== -1;
    });
    this.updateCounter();
  }

  private showToast(type: string, title: string, body: string) {
    this.config = new ToasterConfig({
      positionClass: 'toast-top-right',
      timeout: 5000,
      newestOnTop: true,
      tapToDismiss: true,
      preventDuplicates: false,
      animation: 'slideDown',
      limit: 1,
    });
    const toast: Toast = {
      type: type,
      title: title,
      body: body,
      timeout: 5000,
      showCloseButton: true,
      bodyOutputType: BodyOutputType.TrustedHtml,
    };
    this.toaster.popAsync(toast);
  }

}
