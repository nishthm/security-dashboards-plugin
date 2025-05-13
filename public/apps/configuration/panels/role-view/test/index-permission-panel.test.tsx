/*
 *   Copyright OpenSearch Contributors
 *
 *   Licensed under the Apache License, Version 2.0 (the "License").
 *   You may not use this file except in compliance with the License.
 *   A copy of the License is located at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *   or in the "license" file accompanying this file. This file is distributed
 *   on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 *   express or implied. See the License for the specific language governing
 *   permissions and limitations under the License.
 */

import React from 'react';
import { shallow, mount } from 'enzyme';
import { Action, RoleIndexPermissionView } from '../../../types';
import { ResourceType } from '../../../../../../common';
import {
  renderFieldLevelSecurity,
  IndexPermissionPanel,
  renderDocumentLevelSecurity,
} from '../index-permission-panel';
import { EuiEmptyPrompt, EuiInMemoryTable, EuiTableFieldDataColumnType } from "@elastic/eui";
import { buildHashUrl } from '../../../utils/url-builder';
import { RoleList } from "../../role-list";
import { RoleListing } from "../../../utils/role-list-utils";

describe('Role view - index permission panel', () => {
  const sampleRoleName = 'role1';
  const sampleRoleIndexPermission: RoleIndexPermissionView = {
    id: 1,
    index_patterns: [],
    dls: '',
    fls: [],
    masked_fields: [],
    allowed_actions: [],
  };
  const setMap = jest.fn();

  describe('Render field level security', () => {
    const field = 'fls';
    const excludeField = '~' + field;

    it('renders em-dash when field level security is empty', () => {
      const renderFunc = renderFieldLevelSecurity();
      const Wrapper = () => <>{renderFunc([])}</>;
      const component = mount(<Wrapper />);
      expect(component.find('[data-test-subj="empty-fls-text"]').first().text()).toEqual('—');
    });

    it('renders field level security when it contains exclude fields', () => {
      const renderFunc = renderFieldLevelSecurity();
      const Wrapper = () => <>{renderFunc([excludeField])}</>;
      const component = mount(<Wrapper />);
      expect(component.find('[data-test-subj="fls-text"]').first().text()).toEqual(
        'Exclude: ' + field
      );
    });

    it('renders field level security when it contains include fields', () => {
      const renderFunc = renderFieldLevelSecurity();
      const Wrapper = () => <>{renderFunc([field])}</>;
      const component = mount(<Wrapper />);
      expect(component.find('[data-test-subj="fls-text"]').first().text()).toEqual(
        'Include: ' + field
      );
    });
  });

  describe('Render document level security', () => {
    it('renders em-dash when document level security is empty', () => {
      const renderFunc = renderDocumentLevelSecurity();
      const Wrapper = () => <>{renderFunc('')}</>;
      const component = shallow(<Wrapper />);
      expect(component).toMatchSnapshot();
    });

    it('renders document level security when dls is valid json', () => {
      const renderFunc = renderDocumentLevelSecurity();
      const Wrapper = () => <>{renderFunc('{"key": "value"}')}</>;
      const component = shallow(<Wrapper />);
      expect(component).toMatchSnapshot();
    });

    it('renders document level security when dls is invalid json', () => {
      const renderFunc = renderDocumentLevelSecurity();
      const Wrapper = () => <>{renderFunc('{"key": "value"%%%}')}</>;
      const spy = jest.spyOn(console, 'warn').mockImplementationOnce(() => {});
      const component = shallow(<Wrapper />);
      expect(spy).toBeCalled();
      expect(component).toMatchSnapshot();
    });
  });

  describe('Index permission list', () => {
    it('render empty', () => {
      const wrapper = shallow(
        <IndexPermissionPanel
          roleName={sampleRoleName}
          indexPermissions={[]}
          actionGroups={{}}
          errorFlag={false}
          loading={false}
          isReserved={false}
        />
      );

      expect(wrapper.find(EuiInMemoryTable).prop('items').length).toBe(0);
    });

    it('it renders a empty prompt when indexPermissions is empty', () => {
      const wrapper = mount(
        <IndexPermissionPanel
          roleName={sampleRoleName}
          indexPermissions={[]}
          actionGroups={{}}
          errorFlag={false}
          loading={false}
          isReserved={false}
        />
      );
      const prompt = wrapper
        .find('[data-test-subj="index-permission-container"] tbody EuiEmptyPrompt')
        .first()
        .getElement();
      expect(prompt.type).toBe(EuiEmptyPrompt);
    });

    it('Add index permission button is disabled for reserved role', () => {
      const wrapper = mount(
        <IndexPermissionPanel
          roleName={sampleRoleName}
          indexPermissions={[]}
          actionGroups={{}}
          errorFlag={false}
          loading={false}
          isReserved={true}
        />
      );

      const prompt = wrapper
        .find('[data-test-subj="index-permission-container"] tbody EuiEmptyPrompt')
        .first()
        .getElement();
      const component = shallow(prompt);
      const button = component.find('[data-test-subj="addIndexPermission"]');
      expect(button.prop('disabled')).toBe(true);
    });

    it('should render to role edit page when click on Add index permission button', () => {
      const wrapper = mount(
        <IndexPermissionPanel
          roleName={sampleRoleName}
          indexPermissions={[]}
          actionGroups={{}}
          errorFlag={false}
          loading={false}
          isReserved={true}
        />
      );

      const prompt = wrapper
        .find('[data-test-subj="index-permission-container"] tbody EuiEmptyPrompt')
        .first()
        .getElement();
      const component = shallow(prompt);
      component.find('[data-test-subj="addIndexPermission"]').simulate('click');
      expect(window.location.hash).toBe(
        buildHashUrl(ResourceType.roles, Action.edit, sampleRoleName)
      );
    });

    it('should render everything on index permission panel', () => {
      const wrapper = mount(
        <IndexPermissionPanel
          roleName={sampleRoleName}
          indexPermissions={["test0_*", "test_*", "test1_*", "test2_*"]}
          actionGroups={{}}
          errorFlag={false}
          loading={false}
          isReserved={true}
        />
      );

      const prompt = wrapper
        .find('[data-test-subj="index-permission-container"] tbody EuiEmptyPrompt')
        .first()
        .getElement();
      const component = shallow(prompt);
      component.find('[data-test-subj="addIndexPermission"]').simulate('click');
      expect(window.location.hash).toBe(
        buildHashUrl(ResourceType.roles, Action.edit, sampleRoleName)
      );
    });
  });
});


describe('Render columns', () => {
  beforeEach(() => {
    jest.spyOn(React, 'useState').mockRestore();
    jest
      .spyOn(React, 'useState')
      .mockImplementationOnce(() => [[], jest.fn()])
      .mockImplementationOnce(() => [false, jest.fn()])
      .mockImplementationOnce(() => [[], jest.fn()])
      .mockImplementationOnce(() => [false, jest.fn()]);
  });
  it('render role name column', () => {
    const wrapper = shallow(
      <RoleList
        coreStart={mockCoreStart as any}
        depsStart={{ navigation: {} }}
        params={{} as any}
        config={{} as any}
      />
    );
    const roleList = wrapper.find('[data-test-subj="role-list"]');
    const component = mount(<>{roleList}</>);
    const columns = component.prop<Array<EuiTableFieldDataColumnType<RoleListing>>>('columns');

    const roleNameRenderer = columns[0].render as (roleName: string) => JSX.Element;
    const Container = (props: { roleName: string }) => roleNameRenderer(props.roleName);
    const result = shallow(<Container roleName={'role1'} />);
    expect(result).toMatchSnapshot();
  });

  it('render Customization column', () => {
    const wrapper = shallow(
      <RoleList
        coreStart={mockCoreStart as any}
        depsStart={{ navigation: {} }}
        params={{} as any}
        config={{} as any}
      />
    );
    const roleList = wrapper.find('[data-test-subj="role-list"]');
    const component = mount(<>{roleList}</>);
    const columns = component.prop<Array<EuiTableFieldDataColumnType<RoleListing>>>('columns');

    const customizationRenderer = columns[6].render as (reserved: boolean) => JSX.Element;
    const Container = (props: { reserved: boolean }) => customizationRenderer(props.reserved);
    const result = shallow(<Container reserved={true} />);
    expect(result).toMatchSnapshot();
  });
});
